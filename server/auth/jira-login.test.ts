import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JiraSite } from "../../shared/protocol.ts";
import { createApp } from "../app.ts";
import { memoryStore } from "../store/memory.ts";
import { memoryVault, type Vault } from "../store/vault.ts";
import { SIGN_IN_AGAIN } from "../tickets/jira.ts";
import { noTickets } from "../tickets/none.ts";
import { SignInExpired, type Atlassian } from "./atlassian.ts";
import { jiraLogin, SESSION_MS, type JiraLoginDeps } from "./jira-login.ts";

const ACME: JiraSite = { id: "c-acme", name: "Acme", url: "https://acme.atlassian.net" };
const SIDE: JiraSite = { id: "c-side", name: "Side gig", url: "https://side.atlassian.net" };

/** Atlassian in a box: codes and refresh tokens it hands out, and what it was asked. */
function fakeAtlassian(sites: JiraSite[] = [ACME]) {
  const asked: string[] = [];
  let n = 0;
  /** Refresh tokens that still work. */
  const live = new Set<string>();
  const tokens = () => {
    n++;
    live.add(`refresh-${n}`);
    return { accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresIn: 3600 };
  };
  const atlassian: Atlassian = {
    authorizeUrl: (redirectUri, state) =>
      `https://auth.example/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
    async exchange(code, redirectUri) {
      asked.push(`exchange ${code} ${redirectUri}`);
      if (code !== "good") throw new SignInExpired("bad code");
      return tokens();
    },
    async refresh(refreshToken) {
      asked.push(`refresh ${refreshToken}`);
      if (!live.delete(refreshToken)) throw new SignInExpired("revoked");
      return tokens();
    },
    me: async () => ({ accountId: "acc-sam", name: "Sam" }),
    sites: async () => sites,
  };
  return { atlassian, asked, live };
}

async function serve(over: Partial<JiraLoginDeps> & { sites?: string[]; jiraSites?: JiraSite[] } = {}) {
  const fake = fakeAtlassian(over.jiraSites);
  let clock = 1_000_000;
  const login = jiraLogin({
    atlassian: fake.atlassian,
    vault: memoryVault(),
    now: () => clock,
    log: { info() {}, error() {} },
    sites: [],
    ...over,
  });
  const app = createApp({
    store: memoryStore(),
    auth: login,
    distDir: mkdtempSync(join(tmpdir(), "pp-dist-")),
    ticketsFor: noTickets,
    now: () => clock,
    random: Math.random,
    log: { info() {}, error() {} },
  });
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const { port } = app.server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;
  /** One browser: keeps its cookies, follows no redirects. */
  const jar = new Map<string, string>();
  async function go(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const res = await fetch(origin + path, {
      method: init.method ?? "GET",
      redirect: "manual",
      headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair = "", ...attrs] = c.split("; ");
      const [k = "", v = ""] = pair.split("=");
      if (attrs.includes("Max-Age=0")) jar.delete(k);
      else jar.set(k, v);
    }
    return res;
  }
  /** Signs in the whole way: start, Atlassian says yes, back to the callback. */
  async function signIn(code = "good") {
    const start = await go("/auth/jira/start");
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state") ?? "";
    return go(`/auth/jira/callback?code=${code}&state=${encodeURIComponent(state)}`);
  }
  return {
    ...fake,
    app,
    login,
    origin,
    jar,
    go,
    signIn,
    tick: (ms: number) => void (clock += ms),
    close: () => new Promise((resolve) => app.server.close(resolve)),
  };
}

test("signing in: Atlassian's page, back with a session cookie, and the table uses your Jira", async () => {
  const s = await serve();
  try {
    assert.deepEqual(await (await s.go("/api/host")).json(), { jira: "signIn", user: null });
    const refused = await s.go("/api/rooms", { method: "POST", body: {} });
    assert.equal(refused.status, 401);
    assert.deepEqual(await refused.json(), { error: "Sign in with Jira to open a table", signIn: true });

    const start = await s.go("/auth/jira/start");
    assert.equal(start.status, 302);
    const to = new URL(start.headers.get("location") ?? "");
    assert.equal(to.searchParams.get("redirect_uri"), `${s.origin}/auth/jira/callback`);
    assert.ok(s.jar.has("pp_jira_state"));

    const back = await s.go(
      `/auth/jira/callback?code=good&state=${encodeURIComponent(to.searchParams.get("state") ?? "")}`,
    );
    assert.equal(back.status, 302);
    assert.equal(back.headers.get("location"), "/?host=1");
    assert.ok(s.jar.has("pp_jira"), "signed in");
    assert.ok(!s.jar.has("pp_jira_state"), "the sign-in's state is spent");
    assert.match(back.headers.getSetCookie().join(), /pp_jira=[^;]+; Path=\/; Max-Age=7776000; HttpOnly; SameSite=Lax/);

    assert.deepEqual(await (await s.go("/api/host")).json(), { jira: "signIn", user: { name: "Sam" } });
    const opened = await s.go("/api/rooms", { method: "POST", body: {} });
    assert.equal(opened.status, 200);
    const { code } = (await opened.json()) as { code: string };
    assert.deepEqual(s.app.rooms.get(code)?.snapshot().jira, { account: "acc-sam", site: ACME });
  } finally {
    await s.close();
  }
});

test("a sign-in that wasn't started here, or that Atlassian refused, opens nothing", async () => {
  const s = await serve();
  try {
    const start = await s.go("/auth/jira/start");
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const forged = state.replace(/^[^.]+/, "someone-elses");
    const r1 = await s.go(`/auth/jira/callback?code=good&state=${encodeURIComponent(forged)}`);
    assert.equal(r1.headers.get("location"), "/?host=failed");
    assert.equal((await s.signIn("bad")).headers.get("location"), "/?host=failed", "a code Atlassian won't take");
    const denied = await s.go(`/auth/jira/callback?error=access_denied&state=${encodeURIComponent(state)}`);
    assert.equal(denied.headers.get("location"), "/?host=failed", "the dealer said no");
    assert.ok(!s.jar.has("pp_jira"));
  } finally {
    await s.close();
  }
});

test("previews sign in through the dev site's callback, and only allowed addresses are passed on", async () => {
  const s = await serve({
    callbackUrl: "https://dev.example/auth/jira/callback",
    relay: /^https:\/\/pr-\d+\.example$/,
  });
  try {
    // the preview starts the sign-in with the dev site's callback...
    const start = await s.go("/auth/jira/start");
    const to = new URL(start.headers.get("location") ?? "");
    assert.equal(to.searchParams.get("redirect_uri"), "https://dev.example/auth/jira/callback");

    // ...the dev site passes Atlassian's answer on to the preview it came from...
    const state = (origin: string) => `nonce.${Buffer.from(origin).toString("base64url")}`;
    const relayed = await s.go(`/auth/jira/callback?code=good&state=${state("https://pr-12.example")}`);
    assert.equal(relayed.status, 302);
    assert.equal(
      relayed.headers.get("location"),
      `https://pr-12.example/auth/jira/callback?code=good&state=${state("https://pr-12.example")}`,
    );
    const elsewhere = await s.go(`/auth/jira/callback?code=good&state=${state("https://evil.example")}`);
    assert.equal(elsewhere.status, 400);

    // ...which trades the code with the same callback it started with
    await s.go(`/auth/jira/callback?code=good&state=${to.searchParams.get("state") ?? ""}`);
    assert.deepEqual(s.asked, ["exchange good https://dev.example/auth/jira/callback"]);
  } finally {
    await s.close();
  }
});

test("more than one Jira site: pick one; sites outside the allowed ones can't open tables", async () => {
  const s = await serve({ jiraSites: [ACME, SIDE] });
  try {
    await s.signIn();
    const pick = await s.go("/api/rooms", { method: "POST", body: {} });
    assert.equal(pick.status, 409);
    assert.deepEqual(await pick.json(), { error: "Pick a Jira site", sites: [ACME, SIDE] });
    const opened = await s.go("/api/rooms", { method: "POST", body: { site: SIDE.id } });
    const { code } = (await opened.json()) as { code: string };
    assert.equal(s.app.rooms.get(code)?.snapshot().jira?.site.id, SIDE.id);
  } finally {
    await s.close();
  }

  const only = await serve({ jiraSites: [ACME, SIDE], sites: ["side.atlassian.net"] });
  try {
    await only.signIn();
    const opened = await only.go("/api/rooms", { method: "POST", body: {} });
    assert.equal(opened.status, 200, "the one allowed site needs no pick");
  } finally {
    await only.close();
  }

  const none = await serve({ sites: ["side.atlassian.net"] });
  try {
    await none.signIn();
    const refused = await none.go("/api/rooms", { method: "POST", body: {} });
    assert.equal(refused.status, 403);
    assert.deepEqual(await refused.json(), {
      error: "Your Jira account doesn't have access to side.atlassian.net.",
    });
  } finally {
    await none.close();
  }
});

test("tokens: kept for an hour, refreshed once when they run out, and the new refresh token kept", async () => {
  const s = await serve();
  try {
    await s.signIn();
    assert.equal(await s.login.token("acc-sam"), "access-1", "the token from signing in");
    s.tick(3600_000);
    const [a, b] = await Promise.all([s.login.token("acc-sam"), s.login.token("acc-sam")]);
    assert.equal(a, "access-2");
    assert.equal(b, "access-2");
    assert.deepEqual(s.asked.slice(1), ["refresh refresh-1"], "one refresh for both");
    s.tick(3600_000);
    assert.equal(await s.login.token("acc-sam"), "access-3");
    assert.deepEqual(s.asked.slice(1), ["refresh refresh-1", "refresh refresh-2"], "the rotated one");
  } finally {
    await s.close();
  }
});

test("a login Atlassian won't refresh signs the dealer out, and says how to fix it", async () => {
  const s = await serve();
  try {
    await s.signIn();
    s.live.clear();
    s.tick(3600_000);
    await assert.rejects(s.login.token("acc-sam"), { message: SIGN_IN_AGAIN });
    assert.equal(s.login.signedIn("acc-sam"), false);
    assert.deepEqual(await (await s.go("/api/host")).json(), { jira: "signIn", user: null });
  } finally {
    await s.close();
  }
});

test("signing out forgets the login, and its tables stop using Jira", async () => {
  const s = await serve();
  try {
    await s.signIn();
    const out = await s.go("/auth/jira/signout", { method: "POST" });
    assert.equal(out.status, 204);
    assert.ok(!s.jar.has("pp_jira"));
    assert.equal(s.login.signedIn("acc-sam"), false);
    await assert.rejects(s.login.token("acc-sam"), { message: SIGN_IN_AGAIN });
  } finally {
    await s.close();
  }
});

test("a restart keeps you signed in; 90 days away signs you out", async () => {
  const vault: Vault = memoryVault();
  const s = await serve({ vault });
  try {
    await s.signIn();
  } finally {
    await s.close();
  }
  const req = new IncomingMessage(new Socket());
  req.headers = { cookie: `pp_jira=${s.jar.get("pp_jira") ?? ""}`, host: "x" };
  const opts = { atlassian: fakeAtlassian().atlassian, vault, log: { info() {}, error() {} }, sites: [] };
  const later = jiraLogin({ ...opts, now: () => 1_000_000 + 1000 });
  assert.deepEqual(later.host(req).user, { name: "Sam" });
  const gone = jiraLogin({ ...opts, now: () => 1_000_000 + SESSION_MS + 1 });
  assert.equal(gone.host(req).user, null);
});
