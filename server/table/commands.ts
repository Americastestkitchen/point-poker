// Every command a player can send, as data: its name, who may send it, which
// round move it is, what it carries, and what it does. A new command is one more
// defineCommand() in the list; the Command type, the checks and the dispatch all come from it.
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { ENVIRONMENT, ENVIRONMENT_IDS } from "../../shared/catalog/environments.ts";
import { LookInput, validateLook } from "../../shared/look.ts";
import type { Ticket } from "../../shared/protocol.ts";
import { FLICK_COOLDOWN_MS, nextInQueue, parseIssueKey } from "../../shared/rules.ts";
import { payOut, takeBack } from "./coins.ts";
import { endRound, reveal, settleRound, startRound, type Move } from "./round.ts";
import { clean, isVoter, manualTicket, pickVote } from "./rules.ts";
import type { PlayerState, TableState } from "./state.ts";
import type { TableFx } from "./table.ts";

export type Role = "player" | "dealer";
/** Which round move a command is, so the table checks the phase; "anytime" when every phase allows it. */
export type CommandMove = Move | "anytime";

/** What any command can do to the table it runs on. */
export interface PlayerCtx {
  readonly s: TableState;
  now(): number;
  log(line: string): void;
  changed(): void;
  /** A toast for everyone but `except`, or for `to` alone. */
  notice(text: string, opts?: { level?: "error"; except?: string; to?: string }): void;
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
  /** Fetches one ticket from Jira without dealing it. */
  fetchTicket(ref: string): Promise<Ticket>;
}

/** The context a command gets for its role. The table checks the role and the phase before it runs anything. */
export type CtxFor<R extends Role> = R extends "dealer" ? DealerCtx : PlayerCtx;

/** Nothing means it worked; a string is the reason it didn't. */
type Reply = void | string | Promise<void | string>;

/**
 * One command. `t` is its name on the wire and `input` its fields; the schema
 * (with `t`) is built from them, and `run` gets the parsed command, typed,
 * plus the context for its role: player commands can't touch dealer abilities.
 * `move` says which round move it is; the table refuses it in a phase that move doesn't allow.
 */
export function defineCommand<const T extends string, R extends Role, S extends z.ZodRawShape>(def: {
  t: T;
  role: R;
  move: CommandMove;
  input: S;
  run: (ctx: CtxFor<R>, me: PlayerState, cmd: z.infer<z.ZodObject<{ t: z.ZodLiteral<T> } & S>>) => Reply;
}) {
  return { ...def, schema: z.object({ t: z.literal(def.t), ...def.input }) };
}

export const COMMANDS = [
  /** Put a card down, or swap it; null takes it back. */
  defineCommand({
    t: "vote",
    role: "player",
    move: "vote",
    input: { value: z.number().nullable() },
    run({ s, changed, fx }, me, { value }) {
      if (!isVoter(s, me)) return "You're sitting this one out";
      const vote = pickVote(s, value);
      if (value !== null && vote === null) return "That card isn't in the deck";
      const before = me.vote;
      me.vote = vote;
      if (before !== null && me.vote !== null && before !== me.vote) fx(me.id, { kind: "adjust" }, { except: me.id });
      changed();
    },
  }),
  /** Flick a chip at someone. Has a cooldown. */
  defineCommand({
    t: "flick",
    role: "player",
    move: "anytime",
    input: { target: z.string() },
    run({ s, fx, ready }, me, { target }) {
      if (target === me.id) return "You can't flick yourself";
      if (!s.players.some((p) => p.id === target)) return "There's nobody in that seat";
      if (!ready(me.id, "flick", FLICK_COOLDOWN_MS)) return "Not so fast";
      fx(me.id, { kind: "flick", to: target });
    },
  }),
  defineCommand({
    t: "setLook",
    role: "player",
    move: "anytime",
    input: { look: LookInput },
    run({ changed }, me, { look }) {
      me.look = validateLook(look);
      changed();
    },
  }),

  // ---------- dealer only ----------

  defineCommand({
    t: "loadTicket",
    role: "dealer",
    move: "anytime",
    input: { ref: z.string().max(2000) },
    run(ctx, _me, { ref }) {
      const key = parseIssueKey(ref);
      if (!key) return "That doesn't look like a Jira link or key (like SD-1234)";
      return ctx.load(ref, key);
    },
  }),
  defineCommand({
    t: "manualTicket",
    role: "dealer",
    move: "anytime",
    input: { key: z.string(), summary: z.string(), description: z.string() },
    run({ s, changed, claimTicket }, _me, cmd) {
      const summary = clean(cmd.summary, 300);
      if (!summary) return "The ticket needs a summary";
      claimTicket();
      startRound(s, manualTicket(clean(cmd.key, 30), summary, clean(cmd.description, 6000)));
      changed();
    },
  }),
  defineCommand({
    t: "fetchQueue",
    role: "dealer",
    move: "anytime",
    input: {},
    async run({ s, changed, claimQueue, upcoming }) {
      const lastProject = s.ticket?.key.split("-")[0];
      const current = claimQueue();
      try {
        const { label, tickets } = await upcoming(
          lastProject && /^[A-Z][A-Z0-9_]+$/.test(lastProject) ? lastProject : undefined,
        );
        if (!current()) return; // a newer request (or a clear) won
        s.queue = tickets;
        s.queueLabel = label;
        s.epic = null;
        changed();
      } catch (e) {
        if (current()) return `Couldn't load the sprint: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  }),
  defineCommand({
    t: "clearQueue",
    role: "dealer",
    move: "anytime",
    input: {},
    run({ s, changed, claimQueue }) {
      claimQueue();
      s.queue = [];
      s.queueLabel = "";
      s.epic = null;
      changed();
    },
  }),
  defineCommand({
    t: "dealerPlays",
    role: "dealer",
    move: "anytime",
    input: { plays: z.boolean() },
    run({ s, changed }, me, { plays }) {
      s.settings.dealerPlays = plays;
      if (!plays) me.vote = null;
      changed();
    },
  }),
  /** Moves the table to another room. Only the looks change, so it works mid-round. */
  defineCommand({
    t: "setEnvironment",
    role: "dealer",
    move: "anytime",
    input: { environment: z.enum(ENVIRONMENT_IDS) },
    run({ s, changed, notice }, me, { environment }) {
      if (s.environment === environment) return;
      s.environment = environment;
      notice(`🧳 The dealer moved the table to ${ENVIRONMENT[environment].name}`, { except: me.id });
      changed();
    },
  }),
  defineCommand({
    t: "deal",
    role: "dealer",
    move: "deal",
    input: {},
    run({ s, changed }) {
      startRound(s);
      changed();
    },
  }),
  defineCommand({
    t: "reveal",
    role: "dealer",
    move: "reveal",
    input: {},
    run({ s, changed }) {
      reveal(s);
      changed();
    },
  }),
  defineCommand({
    t: "settle",
    role: "dealer",
    move: "settle",
    input: { finalPoints: z.number() },
    run({ s, changed, now, log }, _me, { finalPoints }) {
      if (!s.settings.deck.some((c) => c.points === finalPoints)) return "That card isn't in the deck";
      if (s.phase === "settled") {
        // the dealer changed their mind: take back the last payout first
        takeBack(s.players);
        s.history.pop();
      }
      const votes = new Map<string, number>();
      for (const p of s.players) if (p.vote !== null && isVoter(s, p)) votes.set(p.id, p.vote);
      const result = payOut(s, votes, finalPoints);
      settleRound(s, finalPoints, result);
      const name = (id: string) => s.players.find((p) => p.id === id)?.name ?? id;
      s.history.push({
        key: s.ticket?.key ?? "?",
        summary: s.ticket?.summary ?? "",
        finalPoints,
        pot: result.pot,
        share: result.share,
        winners: result.winners.map(name),
        houseWon: result.houseWon,
      });
      // a permanent trail in the server logs (`fly logs`), so a forgotten Jira update can be recovered
      log(
        "POINTED " +
          JSON.stringify({
            at: new Date(now()).toISOString(),
            room: s.code,
            key: s.ticket?.key,
            summary: s.ticket?.summary,
            points: finalPoints,
            votes: Object.fromEntries([...votes].map(([id, v]) => [name(id), v])),
          }),
      );
      changed();
    },
  }),
  defineCommand({
    t: "nextRound",
    role: "dealer",
    move: "anytime",
    input: {},
    run(ctx) {
      const { s } = ctx;
      ctx.claimTicket();
      endRound(s);
      const next = nextInQueue(s);
      ctx.changed();
      if (next) return ctx.load(next.key, next.key);
    },
  }),
  /** Drop the current round (no payout) and go back to picking a ticket. */
  defineCommand({
    t: "cancelRound",
    role: "dealer",
    move: "cancel",
    input: {},
    run({ s, changed, notice, claimTicket }, me) {
      claimTicket();
      endRound(s);
      notice("🎩 The dealer cancelled this round", { except: me.id });
      changed();
    },
  }),
  /** Skip the current ticket (no payout) and deal the next one in the queue. */
  defineCommand({
    t: "skip",
    role: "dealer",
    move: "skip",
    input: {},
    run(ctx, me) {
      const { s } = ctx;
      // outside waiting there's always a ticket out; this only tells the compiler
      if (!s.ticket) return "There's no ticket to skip";
      const skippedKey = s.ticket.key;
      s.skipped.push(skippedKey);
      const next = nextInQueue(s);
      ctx.claimTicket();
      endRound(s);
      ctx.notice(`⏭️ The dealer skipped ${skippedKey}`, { except: me.id });
      ctx.changed();
      if (next) return ctx.load(next.key, next.key);
    },
  }),
  /** Fetch the ticket that's out again from Jira: its text updates for everyone, the votes and the round stay. */
  defineCommand({
    t: "refreshTicket",
    role: "dealer",
    move: "refresh",
    input: {},
    async run({ s, changed, notice, fetchTicket }, me) {
      const before = s.ticket;
      // outside waiting there's always a ticket out; this only tells the compiler
      if (!before) return "There's no ticket to refresh";
      if (!before.url) return "A ticket typed in by hand isn't in Jira";
      let fresh: Ticket;
      try {
        fresh = await fetchTicket(before.key);
      } catch (e) {
        return `Couldn't refresh ${before.key}: ${e instanceof Error ? e.message : String(e)}`;
      }
      if (s.ticket?.key !== before.key) return; // the dealer moved on meanwhile
      if (isDeepStrictEqual(s.ticket, fresh)) {
        notice(`${before.key} is already up to date`, { to: me.id });
        return;
      }
      s.ticket = fresh;
      changed();
      notice(`🔄 ${before.key} was updated`);
    },
  }),
  defineCommand({
    t: "kick",
    role: "dealer",
    move: "anytime",
    input: { id: z.string() },
    run({ s, changed, notice, remove }, me, { id }) {
      const p = s.players.find((x) => x.id === id);
      if (!p) return "They're not at this table";
      if (p.id === me.id || p.id === s.dealerId) return "You can't remove yourself";
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
  readonly move: CommandMove;
  readonly schema: z.ZodType;
  // A method, so each command's own `run` fits here. The table only ever
  // hands it what that command's schema parsed, after checking the role and the phase.
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
