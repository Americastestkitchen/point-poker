// Entry point: reads the environment, builds the adapters and starts the app.
// The only file that touches process.env.
import { join } from "node:path";
import { createApp } from "./app.ts";
import { atlassian } from "./auth/atlassian.ts";
import { passcodeAuth } from "./auth/dealer.ts";
import { jiraLogin } from "./auth/jira-login.ts";
import { fileStore } from "./store/file.ts";
import { memoryStore } from "./store/memory.ts";
import { fileVault, memoryVault } from "./store/vault.ts";
import type { TableJira } from "./table/state.ts";
import { jiraSource } from "./tickets/jira.ts";
import { noTickets } from "./tickets/none.ts";
import type { TicketSource } from "./tickets/source.ts";

const env = process.env;
const log = console;

// The server's own Jira login: a shared API token, for local dev (and tables saved before
// dealers signed in themselves).
const shared =
  env.JIRA_BASE_URL && env.JIRA_EMAIL && env.JIRA_API_TOKEN
    ? jiraSource({
        baseUrl: env.JIRA_BASE_URL,
        auth: { kind: "apiToken", email: env.JIRA_EMAIL, token: env.JIRA_API_TOKEN },
        pointsField: env.JIRA_POINTS_FIELD,
        defaultProject: env.JIRA_PROJECT,
      })
    : noTickets();

// Saving is on when DATA_DIR is set (production mounts a Fly volume there).
const dataDir = env.DATA_DIR;
const persist = !!dataDir;

/**
 * Where dealers' Jira logins are kept, sealed with TOKEN_KEY: DATA_DIR (production), or .data/
 * locally, so a restart doesn't sign you out. Without TOKEN_KEY, in memory only.
 */
function tokenVault() {
  if (env.TOKEN_KEY) return fileVault(dataDir ?? join(process.cwd(), ".data"), "jira.json", env.TOKEN_KEY, log);
  log.error("TOKEN_KEY isn't set: Jira sign-ins won't survive a restart");
  return memoryVault();
}

// Dealers sign in with their own Jira account when the server has an Atlassian app.
const login =
  env.ATLASSIAN_CLIENT_ID && env.ATLASSIAN_CLIENT_SECRET
    ? jiraLogin({
        atlassian: atlassian({
          clientId: env.ATLASSIAN_CLIENT_ID,
          clientSecret: env.ATLASSIAN_CLIENT_SECRET,
          scopes: env.ATLASSIAN_SCOPES,
        }),
        vault: tokenVault(),
        now: Date.now,
        log,
        // only tickets from these sites (default: JIRA_BASE_URL's), so outsiders can't open tables
        sites: (env.JIRA_SITES ?? (env.JIRA_BASE_URL ? new URL(env.JIRA_BASE_URL).host : ""))
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean),
        callbackUrl: env.ATLASSIAN_CALLBACK_URL || undefined,
        relay: env.ATLASSIAN_RELAY ? new RegExp(env.ATLASSIAN_RELAY) : undefined,
      })
    : null;

/** One ticket source per dealer login and site, made when a table first needs it. */
const sources = new Map<string, TicketSource>();
function ticketsFor(jira: TableJira | null): TicketSource {
  if (!jira || !login) return shared;
  const key = `${jira.account} ${jira.site.id}`;
  let source = sources.get(key);
  if (!source) {
    const { account } = jira;
    const own = jiraSource({
      baseUrl: jira.site.url,
      auth: { kind: "oauth", cloudId: jira.site.id, token: () => login.token(account) },
      pointsField: env.JIRA_POINTS_FIELD,
      defaultProject: env.JIRA_PROJECT,
    });
    source = {
      // once the dealer signs out (or the login expires), the table types tickets in by hand
      get enabled() {
        return login.signedIn(account);
      },
      get: own.get,
      find: own.find,
    };
    sources.set(key, source);
  }
  return source;
}

const app = createApp({
  store: dataDir ? fileStore(dataDir, log) : memoryStore(),
  // Opening a table needs a Jira sign-in, or else the host passcode when set. Players only need the invite link.
  auth: login ?? passcodeAuth(env.HOST_PASSCODE ?? ""),
  ticketsFor,
  now: Date.now,
  random: Math.random,
  log,
  distDir: join(import.meta.dirname, "..", "dist"),
});

setInterval(app.sweep, 10 * 60_000).unref();

// Save tables every few seconds, and once more on shutdown (Fly sends SIGINT on deploys).
if (persist) {
  setInterval(app.save, 5_000).unref();
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      app.save();
      log.log(`saved ${app.rooms.size} table(s), shutting down`);
      process.exit(0);
    });
  }
}

const port = Number(env.PORT ?? 8787);
app.server.listen(port, () => {
  log.log(
    `Point Poker on http://localhost:${port} (Jira ${login ? "sign-in" : shared.enabled ? "shared token" : "not configured"}, ` +
      `${persist ? `${app.rooms.size} saved table(s) restored` : "tables not saved"})`,
  );
});
