// Every command a player can send, as data: its name, who may send it, what
// it carries, and what it does. A new command is one more defineCommand() in
// the list; the Command type, the checks and the dispatch all come from it.
import { z } from "zod";
import { LookInput, validateLook } from "../../shared/look.ts";
import { FLICK_COOLDOWN_MS, nextInQueue, parseIssueKey } from "../../shared/rules.ts";
import { payOut, potOf, takeBack } from "./coins.ts";
import { clean, isVoter, manualTicket, pickVote, resetTable, startRound } from "./rules.ts";
import type { PlayerState, TableState } from "./state.ts";
import type { TableFx } from "./table.ts";

export type Role = "player" | "dealer";

/** What any command can do to the table it runs on. */
export interface PlayerCtx {
  readonly s: TableState;
  now(): number;
  log(line: string): void;
  changed(): void;
  notice(text: string, opts?: { level?: "error"; except?: string }): void;
  fx(from: string, fx: TableFx, opts?: { except?: string }): void;
  /** True (and starts the clock) when `what` is off cooldown for this player. */
  ready(playerId: string, what: string, cooldownMs: number): boolean;
}

/** What only the dealer's commands can do on top of that. */
export interface DealerCtx extends PlayerCtx {
  remove(player: PlayerState, reason: string): void;
  /** Starts a ticket change and returns a check that turns false once a newer one starts. */
  claimTicket(): () => boolean;
  claimQueue(): () => boolean;
  /** Loads a ticket (or an epic's first child) and deals it; resolves to an error message on failure. */
  load(ref: string, label: string): Promise<string | void>;
  upcoming(project: string | undefined): Promise<{ label: string; tickets: TableState["queue"] }>;
}

/** The context a command gets for its role. The table checks the role before it runs anything. */
export type CtxFor<R extends Role> = R extends "dealer" ? DealerCtx : PlayerCtx;

/** Nothing means it worked; a string is the reason it didn't. */
type Reply = void | string | Promise<void | string>;

/**
 * One command. `t` is its name on the wire and `input` its fields; the schema
 * (with `t`) is built from them, and `run` gets the parsed command, typed,
 * plus the context for its role: player commands can't touch dealer abilities.
 */
export function defineCommand<const T extends string, R extends Role, S extends z.ZodRawShape>(def: {
  t: T;
  role: R;
  input: S;
  run: (ctx: CtxFor<R>, me: PlayerState, cmd: z.infer<z.ZodObject<{ t: z.ZodLiteral<T> } & S>>) => Reply;
}) {
  return { ...def, schema: z.object({ t: z.literal(def.t), ...def.input }) };
}

export const COMMANDS = [
  defineCommand({
    t: "vote", role: "player", input: { value: z.number().nullable() },
    run({ s, changed, fx }, me, { value }) {
      if (s.phase !== "voting" || !isVoter(s, me)) return;
      const before = me.vote;
      me.vote = pickVote(s, value);
      if (before !== null && me.vote !== null && before !== me.vote) fx(me.id, { kind: "adjust" }, { except: me.id });
      changed();
    },
  }),
  /** Flick a chip at someone. Has a cooldown. */
  defineCommand({
    t: "flick", role: "player", input: { target: z.string() },
    run({ s, fx, ready }, me, { target }) {
      if (target === me.id || !s.players.some((p) => p.id === target)) return;
      if (!ready(me.id, "flick", FLICK_COOLDOWN_MS)) return "Not so fast";
      fx(me.id, { kind: "flick", to: target });
    },
  }),
  defineCommand({
    t: "setLook", role: "player", input: { look: LookInput },
    run({ changed }, me, { look }) {
      me.look = validateLook(look);
      changed();
    },
  }),

  // ---------- dealer only ----------

  defineCommand({
    t: "loadTicket", role: "dealer", input: { ref: z.string().max(2000) },
    run(ctx, _me, { ref }) {
      const key = parseIssueKey(ref);
      if (!key) return "That doesn't look like a Jira link or key (like SD-1234)";
      return ctx.load(ref, key);
    },
  }),
  defineCommand({
    t: "manualTicket", role: "dealer", input: { key: z.string(), summary: z.string(), description: z.string() },
    run({ s, changed, claimTicket }, _me, cmd) {
      const summary = clean(cmd.summary, 300);
      if (!summary) return;
      claimTicket();
      s.ticket = manualTicket(clean(cmd.key, 30), summary, clean(cmd.description, 6000));
      startRound(s);
      changed();
    },
  }),
  defineCommand({
    t: "fetchQueue", role: "dealer", input: {},
    async run({ s, changed, claimQueue, upcoming }) {
      const lastProject = s.ticket?.key.split("-")[0];
      const current = claimQueue();
      try {
        const { label, tickets } = await upcoming(lastProject && /^[A-Z][A-Z0-9_]+$/.test(lastProject) ? lastProject : undefined);
        if (!current()) return;
        s.queue = tickets;
        s.queueLabel = label;
        s.epic = null;
        changed();
      } catch (e) {
        if (current()) return `Couldn't load the sprint: ${(e as Error).message}`;
      }
    },
  }),
  defineCommand({
    t: "clearQueue", role: "dealer", input: {},
    run({ s, changed, claimQueue }) {
      claimQueue();
      s.queue = [];
      s.queueLabel = "";
      s.epic = null;
      changed();
    },
  }),
  defineCommand({
    t: "dealerPlays", role: "dealer", input: { plays: z.boolean() },
    run({ s, changed }, me, { plays }) {
      s.settings.dealerPlays = plays;
      if (!plays) me.vote = null;
      changed();
    },
  }),
  defineCommand({
    t: "deal", role: "dealer", input: {},
    run({ s, changed }) {
      if (!s.ticket) return "Load a ticket first";
      startRound(s);
      changed();
    },
  }),
  defineCommand({
    t: "reveal", role: "dealer", input: {},
    run({ s, changed }) {
      if (s.phase !== "voting") return;
      s.phase = "revealed";
      s.pot = potOf(s.players);
      changed();
    },
  }),
  defineCommand({
    t: "settle", role: "dealer", input: { finalPoints: z.number() },
    run({ s, changed, now, log }, _me, { finalPoints }) {
      if (s.phase !== "revealed" && s.phase !== "settled") return;
      if (!s.settings.deck.some((c) => c.points === finalPoints)) return;
      if (s.phase === "settled") {
        // the dealer changed their mind: take back the last payout first
        takeBack(s.players);
        s.history.pop();
      }
      const votes = new Map<string, number>();
      for (const p of s.players) if (p.vote !== null && isVoter(s, p)) votes.set(p.id, p.vote);
      const result = payOut(s, votes, finalPoints);
      s.phase = "settled";
      s.finalPoints = finalPoints;
      s.pot = result.pot;
      s.winners = result.winners;
      s.share = result.share;
      s.houseWon = result.houseWon;
      const name = (id: string) => s.players.find((p) => p.id === id)?.name ?? id;
      s.history.push({
        key: s.ticket?.key ?? "?", summary: s.ticket?.summary ?? "", finalPoints,
        pot: result.pot, share: result.share, winners: result.winners.map(name), houseWon: result.houseWon,
      });
      // a permanent trail in the server logs (`fly logs`), so a forgotten Jira update can be recovered
      log("POINTED " + JSON.stringify({
        at: new Date(now()).toISOString(), room: s.code, key: s.ticket?.key, summary: s.ticket?.summary,
        points: finalPoints, votes: Object.fromEntries([...votes].map(([id, v]) => [name(id), v])),
      }));
      changed();
    },
  }),
  defineCommand({
    t: "nextRound", role: "dealer", input: {},
    run(ctx) {
      const { s } = ctx;
      ctx.claimTicket();
      resetTable(s);
      s.ticket = null;
      const next = nextInQueue(s);
      ctx.changed();
      if (next) return ctx.load(next.key, next.key);
    },
  }),
  /** Drop the current round (no payout) and go back to picking a ticket. */
  defineCommand({
    t: "cancelRound", role: "dealer", input: {},
    run({ s, changed, notice, claimTicket }, me) {
      if (s.phase === "waiting" && !s.ticket) return;
      if (s.phase === "settled") return; // already paid out; just pick the next ticket
      claimTicket();
      resetTable(s);
      s.ticket = null;
      notice("🎩 The dealer cancelled this round", { except: me.id });
      changed();
    },
  }),
  /** Skip the current ticket (no payout) and deal the next one in the queue. */
  defineCommand({
    t: "skip", role: "dealer", input: {},
    run(ctx, me) {
      const { s } = ctx;
      if (!s.ticket || s.phase === "settled") return;
      const skippedKey = s.ticket.key;
      s.skipped.push(skippedKey);
      const next = nextInQueue(s);
      ctx.claimTicket();
      resetTable(s);
      s.ticket = null;
      ctx.notice(`⏭️ The dealer skipped ${skippedKey}`, { except: me.id });
      ctx.changed();
      if (next) return ctx.load(next.key, next.key);
    },
  }),
  defineCommand({
    t: "kick", role: "dealer", input: { id: z.string() },
    run({ s, changed, notice, remove }, me, { id }) {
      const p = s.players.find((x) => x.id === id);
      if (!p || p.id === me.id || p.id === s.dealerId) return;
      s.banned.push(p.token);
      remove(p, "Removed by the dealer");
      notice(`👋 ${p.name} was removed from the table`);
      changed();
    },
  }),
] as const;

/** Everything a player can send. */
export type Command = z.infer<(typeof COMMANDS)[number]["schema"]>;

/** Any command, as the table runs it: found by name, then checked against its own schema. */
export interface CommandDef {
  readonly t: string;
  readonly role: Role;
  readonly schema: z.ZodType;
  // A method, so each command's own `run` fits here. The table only ever
  // hands it what that command's schema parsed, after checking the role.
  run(ctx: DealerCtx, me: PlayerState, cmd: unknown): Reply;
}

const BY_NAME = new Map<string, CommandDef>();
for (const c of COMMANDS) {
  if (BY_NAME.has(c.t)) throw new Error(`Two commands are called "${c.t}"`);
  BY_NAME.set(c.t, c);
}

/** The definition for whatever `cmd` says it is, if there is one. */
export function findCommand(cmd: unknown): CommandDef | undefined {
  if (typeof cmd !== "object" || cmd === null || !("t" in cmd) || typeof cmd.t !== "string") return undefined;
  return BY_NAME.get(cmd.t);
}
