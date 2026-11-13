// Entry point: reads the environment, builds the adapters and starts the app.
// The only file that touches process.env.
import { join } from "node:path";
import { createApp } from "./app.ts";
import { passcodeAuth } from "./auth/passcode.ts";
import { fileStore } from "./store/file.ts";
import { memoryStore } from "./store/memory.ts";
import { jiraSource } from "./tickets/jira.ts";
import { noTickets } from "./tickets/none.ts";

const env = process.env;
const log = console;

const jira =
  env.JIRA_BASE_URL && env.JIRA_EMAIL && env.JIRA_API_TOKEN
    ? jiraSource({
        baseUrl: env.JIRA_BASE_URL,
        auth: { kind: "apiToken", email: env.JIRA_EMAIL, token: env.JIRA_API_TOKEN },
        pointsField: env.JIRA_POINTS_FIELD,
        defaultProject: env.JIRA_PROJECT,
      })
    : noTickets();

// Saving is on when DATA_DIR is set (production mounts a Fly volume there).
const persist = !!env.DATA_DIR;

const app = createApp({
  store: persist ? fileStore(env.DATA_DIR!, log) : memoryStore(),
  // Opening a table (and so using the Jira token) needs this when set. Players only need the invite link.
  auth: passcodeAuth(env.HOST_PASSCODE ?? ""),
  ticketsFor: () => jira,
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
    `Point Poker on http://localhost:${port} (Jira ${jira.enabled ? "connected" : "not configured"}, ` +
      `${persist ? `${app.rooms.size} saved table(s) restored` : "tables not saved"})`,
  );
});
