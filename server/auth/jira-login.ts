// Dealers sign in with their own Jira account (Atlassian OAuth 2.0, 3LO) to open a table.
//
// - The browser only ever holds a random session cookie. Refresh tokens stay on the server,
//   sealed in the vault (DATA_DIR/jira.json), so a dealer stays signed in across reloads,
//   tables and deploys until they sign out or Atlassian expires the login.
// - Access tokens last an hour and live in memory; `token(account)` refreshes them, one
//   refresh at a time per account, and saves the rotated refresh token each time.
// - Atlassian only sends dealers back to callback URLs registered on the app, so PR previews
//   and local runs (each on its own address) sign in through the dev site: the dev site's
//   callback passes the one-time code on to where it came from, which trades it for tokens itself.
import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { JiraSite, type HostInfo, type OpenRefusal } from "../../shared/protocol.ts";
import type { Log } from "../table/table.ts";
import type { Vault } from "../store/vault.ts";
import { SIGN_IN_AGAIN } from "../tickets/jira.ts";
import { SignInExpired, type Atlassian } from "./atlassian.ts";
import type { DealerAuth, OpenCheck } from "./dealer.ts";

/** A dealer who doesn't come back for this long signs in again. */
export const SESSION_MS = 90 * 24 * 3600_000;
const SESSION_COOKIE = "pp_jira";
const STATE_COOKIE = "pp_jira_state";

const Saved = z
  .object({
    /** By Atlassian account ID. */
    accounts: z.record(z.string(), z.object({ name: z.string(), refreshToken: z.string(), sites: z.array(JiraSite) })),
    /** By the SHA-256 of the session cookie, so the file alone can't sign anyone in. */
    sessions: z.record(z.string(), z.object({ account: z.string(), seen: z.number() })),
  })
  .catch({ accounts: {}, sessions: {} });
type Saved = z.infer<typeof Saved>;

export interface JiraLoginDeps {
  atlassian: Atlassian;
  vault: Vault;
  now(): number;
  log: Log;
  /** Hosts of the Jira sites tables may use, like acme.atlassian.net. Empty allows any. */
  sites: string[];
  /** The callback registered on the Atlassian app, when it isn't this server's own (previews, local). */
  callbackUrl?: string;
  /** Origins this server's callback passes sign-ins on to (PR previews, local runs). */
  relay?: RegExp;
}

const hash = (id: string) => createHash("sha256").update(id).digest("base64url");

function cookies(req: IncomingMessage): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq).trim(), decodeURIComponent(part.slice(eq + 1).trim()));
  }
  return jar;
}

/** The address the browser used, like https://point-poker.fly.dev (Fly sets x-forwarded-proto). */
function originOf(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || "http";
  return `${proto}://${req.headers.host ?? "localhost"}`;
}

function cookie(name: string, value: string, opts: { path: string; maxAge: number; secure: boolean }) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${opts.path}`,
    `Max-Age=${Math.floor(opts.maxAge / 1000)}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(opts.secure ? ["Secure"] : []),
  ].join("; ");
}

const redirect = (res: ServerResponse, to: string, setCookie: string[] = []) => {
  res.writeHead(302, { location: to, "cache-control": "no-store", "set-cookie": setCookie });
  res.end();
};

export function jiraLogin(deps: JiraLoginDeps): DealerAuth & {
  /** A working access token for `account`, refreshed when needed. */
  token(account: string): Promise<string>;
  /** Is `account` still signed in (so its tables can load tickets)? */
  signedIn(account: string): boolean;
} {
  const { atlassian, vault, now, log } = deps;
  const saved: Saved = Saved.parse(vault.load() ?? undefined);
  const access = new Map<string, { token: string; expires: number }>();
  const refreshing = new Map<string, Promise<string>>();
  const save = () => vault.save(saved);

  /** Sessions nobody has used for SESSION_MS are dropped, and accounts nobody is signed in as. */
  function sweep() {
    const cutoff = now() - SESSION_MS;
    for (const [id, s] of Object.entries(saved.sessions)) if (s.seen < cutoff) delete saved.sessions[id];
  }
  sweep();

  const allowed = (site: JiraSite) => deps.sites.length === 0 || deps.sites.includes(new URL(site.url).host);
  const redirectUri = (origin: string) => deps.callbackUrl ?? `${origin}/auth/jira/callback`;

  /** The signed-in account behind this request's cookie, keeping the session alive. */
  function sessionOf(req: IncomingMessage) {
    const id = cookies(req).get(SESSION_COOKIE);
    if (!id) return null;
    const key = hash(id);
    const session = saved.sessions[key];
    const account = session && saved.accounts[session.account];
    if (!session || !account || session.seen < now() - SESSION_MS) return null;
    // note a visit at most once a day, so the vault isn't rewritten on every request
    if (now() - session.seen > 24 * 3600_000) {
      session.seen = now();
      save();
    }
    return { key, accountId: session.account, account };
  }

  /** Forgets an account's tokens and every session signed in as it. */
  function forget(accountId: string) {
    delete saved.accounts[accountId];
    for (const [id, s] of Object.entries(saved.sessions)) if (s.account === accountId) delete saved.sessions[id];
    access.delete(accountId);
    save();
  }

  async function refresh(accountId: string): Promise<string> {
    const account = saved.accounts[accountId];
    if (!account) throw new Error(SIGN_IN_AGAIN);
    try {
      const t = await atlassian.refresh(account.refreshToken);
      // the old refresh token stops working: keep the new one before anything else
      account.refreshToken = t.refreshToken;
      save();
      access.set(accountId, { token: t.accessToken, expires: now() + t.expiresIn * 1000 });
      return t.accessToken;
    } catch (e) {
      if (e instanceof SignInExpired) {
        log.info(`Jira sign-in for ${account.name} expired`);
        forget(accountId);
        throw new Error(SIGN_IN_AGAIN, { cause: e });
      }
      log.error("Jira token refresh failed", e);
      throw new Error("Couldn't reach Atlassian to load from Jira. Try again in a moment.", { cause: e });
    }
  }

  function token(accountId: string): Promise<string> {
    const cached = access.get(accountId);
    // a minute's margin, so a token doesn't run out on its way to Jira
    if (cached && cached.expires - 60_000 > now()) return Promise.resolve(cached.token);
    let pending = refreshing.get(accountId);
    if (!pending) {
      pending = refresh(accountId).finally(() => refreshing.delete(accountId));
      refreshing.set(accountId, pending);
    }
    return pending;
  }

  async function start(req: IncomingMessage, res: ServerResponse) {
    const origin = originOf(req);
    const nonce = randomBytes(16).toString("base64url");
    // the state says where to finish (a preview's or local address, through the dev site's callback)
    const state = `${nonce}.${Buffer.from(origin).toString("base64url")}`;
    const secure = origin.startsWith("https:");
    redirect(res, atlassian.authorizeUrl(redirectUri(origin), state), [
      cookie(STATE_COOKIE, nonce, { path: "/auth/jira", maxAge: 10 * 60_000, secure }),
    ]);
  }

  async function callback(req: IncomingMessage, res: ServerResponse, url: URL) {
    const origin = originOf(req);
    const secure = origin.startsWith("https:");
    const [nonce = "", from = ""] = (url.searchParams.get("state") ?? "").split(".");
    const startedAt = Buffer.from(from, "base64url").toString();
    if (startedAt && startedAt !== origin) {
      // a preview's or local sign-in, sent back to the callback registered on the app: pass it on
      if (deps.relay?.test(startedAt)) return redirect(res, `${startedAt}/auth/jira/callback${url.search}`);
      res.writeHead(400, { "content-type": "text/plain" });
      return res.end("This sign-in didn't start here.");
    }
    const clearState = cookie(STATE_COOKIE, "", { path: "/auth/jira", maxAge: 0, secure });
    const code = url.searchParams.get("code");
    if (!code || !nonce || cookies(req).get(STATE_COOKIE) !== nonce) {
      // the dealer said no, or the sign-in is stale or not theirs
      return redirect(res, "/?host=failed", [clearState]);
    }
    try {
      const t = await atlassian.exchange(code, redirectUri(origin));
      const [me, sites] = await Promise.all([atlassian.me(t.accessToken), atlassian.sites(t.accessToken)]);
      saved.accounts[me.accountId] = { name: me.name, refreshToken: t.refreshToken, sites };
      access.set(me.accountId, { token: t.accessToken, expires: now() + t.expiresIn * 1000 });
      const id = randomBytes(32).toString("base64url");
      saved.sessions[hash(id)] = { account: me.accountId, seen: now() };
      sweep();
      save();
      log.info(`${me.name} signed in with Jira (${sites.map((s) => s.name).join(", ") || "no sites"})`);
      redirect(res, "/?host=1", [clearState, cookie(SESSION_COOKIE, id, { path: "/", maxAge: SESSION_MS, secure })]);
    } catch (e) {
      log.error("Jira sign-in failed", e);
      redirect(res, "/?host=failed", [clearState]);
    }
  }

  function signOut(req: IncomingMessage, res: ServerResponse) {
    const session = sessionOf(req);
    if (session) {
      delete saved.sessions[session.key];
      // signed out everywhere: its tables stop loading from Jira too
      const stillIn = Object.values(saved.sessions).some((s) => s.account === session.accountId);
      if (stillIn) save();
      else forget(session.accountId);
    }
    const secure = originOf(req).startsWith("https:");
    res.writeHead(204, { "set-cookie": cookie(SESSION_COOKIE, "", { path: "/", maxAge: 0, secure }) });
    res.end();
  }

  const refuse = (status: 401 | 403 | 409, refusal: OpenRefusal): OpenCheck => ({ ok: false, status, refusal });

  return {
    needsPasscode: false,
    token,
    signedIn: (account) => account in saved.accounts,
    open(req, body) {
      const session = sessionOf(req);
      if (!session) return refuse(401, { error: "Sign in with Jira to open a table", signIn: true });
      const sites = session.account.sites.filter(allowed);
      if (sites.length === 0) {
        const want = deps.sites.join(" or ");
        return refuse(403, {
          error: want
            ? `Your Jira account doesn't have access to ${want}.`
            : "Your Atlassian account doesn't have a Jira site.",
        });
      }
      const site = sites.find((s) => s.id === body.site) ?? (sites.length === 1 ? sites[0] : undefined);
      if (!site) return refuse(409, { error: "Pick a Jira site", sites });
      return { ok: true, jira: { account: session.accountId, site } };
    },
    host(req): HostInfo {
      const session = sessionOf(req);
      return { jira: "signIn", user: session && { name: session.account.name } };
    },
    async route(req, res, url) {
      if (url.pathname === "/auth/jira/start" && req.method === "GET") await start(req, res);
      else if (url.pathname === "/auth/jira/callback" && req.method === "GET") await callback(req, res, url);
      else if (url.pathname === "/auth/jira/signout" && req.method === "POST") signOut(req, res);
      else return false;
      return true;
    },
  };
}
