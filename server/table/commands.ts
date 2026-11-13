// Every command a player can send, as data: who may run it, what it looks
// like, and what it does. A new command is one new entry.
import type { z } from "zod";
import { validateLook } from "../../shared/look.ts";
import { Commands, type Command } from "../../shared/protocol.ts";
import { FLICK_COOLDOWN_MS, nextInQueue, parseIssueKey } from "../../shared/rules.ts";
import { payOut, potOf, takeBack } from "./coins.ts";
import { clean, isVoter, manualTicket, pickVote, resetTable, startRound } from "./rules.ts";
import type { PlayerState, TableState } from "./state.ts";
import type { TableFx } from "./table.ts";

export type Role = "player" | "dealer";

/** What a command can do to the table it runs on. */
export interface Ctx {
  readonly s: TableState;
  now(): number;
  log(line: string): void;
  changed(): void;
  notice(text: string, opts?: { level?: "error"; except?: string }): void;
  fx(fx: TableFx, except?: string): void;
  remove(player: PlayerState, reason: string): void;
  /** True (and starts the clock) when `what` is off cooldown for this player. */
  ready(playerId: string, what: string, cooldownMs: number): boolean;
  /** Starts a ticket change and returns a check that turns false once a newer one starts. */
  claimTicket(): () => boolean;
  claimQueue(): () => boolean;
  /** Loads a ticket (or an epic's first child) and deals it; resolves to an error message on failure. */
  load(ref: string, label: string): Promise<string | void>;
  upcoming(project: string | undefined): Promise<{ label: string; tickets: TableState["queue"] }>;
}

type Run<C> = (ctx: Ctx, me: PlayerState, cmd: C) => void | string | Promise<void | string>;
export interface CommandSpec<C> { role: Role; schema: z.ZodType<C>; run: Run<C> }
type Spec<K extends Command["t"]> = CommandSpec<Extract<Command, { t: K }>>;

export const COMMANDS: { [K in Command["t"]]: Spec<K> } = {
  vote: {
    role: "player", schema: Commands.vote,
    run({ s, changed, fx }, me, { value }) {
      if (s.phase !== "voting" || !isVoter(s, me)) return;
      const before = me.vote;
      me.vote = pickVote(s, value);
      if (before !== null && me.vote !== null && before !== me.vote) fx({ kind: "adjust", id: me.id }, me.id);
      changed();
    },
  },
  flick: {
    role: "player", schema: Commands.flick,
    run({ s, fx, ready }, me, { target }) {
      if (target === me.id || !s.players.some((p) => p.id === target)) return;
      if (!ready(me.id, "flick", FLICK_COOLDOWN_MS)) return "Not so fast";
      fx({ kind: "flick", from: me.id, to: target });
    },
  },
  setLook: {
    role: "player", schema: Commands.setLook,
    run({ changed }, me, { look }) {
      me.look = validateLook(look);
      changed();
    },
  },

  // ---------- dealer only ----------

  loadTicket: {
    role: "dealer", schema: Commands.loadTicket,
    run(ctx, _me, { ref }) {
      const key = parseIssueKey(ref);
      if (!key) return "That doesn't look like a Jira link or key (like SD-1234)";
      return ctx.load(ref, key);
    },
  },
  manualTicket: {
    role: "dealer", schema: Commands.manualTicket,
    run({ s, changed, claimTicket }, _me, cmd) {
      const summary = clean(cmd.summary, 300);
      if (!summary) return;
      claimTicket();
      s.ticket = manualTicket(clean(cmd.key, 30), summary, clean(cmd.description, 6000));
      startRound(s);
      changed();
    },
  },
  fetchQueue: {
    role: "dealer", schema: Commands.fetchQueue,
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
  },
  clearQueue: {
    role: "dealer", schema: Commands.clearQueue,
    run({ s, changed, claimQueue }) {
      claimQueue();
      s.queue = [];
      s.queueLabel = "";
      s.epic = null;
      changed();
    },
  },
  dealerPlays: {
    role: "dealer", schema: Commands.dealerPlays,
    run({ s, changed }, me, { plays }) {
      s.settings.dealerPlays = plays;
      if (!plays) me.vote = null;
      changed();
    },
  },
  deal: {
    role: "dealer", schema: Commands.deal,
    run({ s, changed }) {
      if (!s.ticket) return "Load a ticket first";
      startRound(s);
      changed();
    },
  },
  reveal: {
    role: "dealer", schema: Commands.reveal,
    run({ s, changed }) {
      if (s.phase !== "voting") return;
      s.phase = "revealed";
      s.pot = potOf(s.players);
      changed();
    },
  },
  settle: {
    role: "dealer", schema: Commands.settle,
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
  },
  nextRound: {
    role: "dealer", schema: Commands.nextRound,
    run(ctx) {
      const { s } = ctx;
      ctx.claimTicket();
      resetTable(s);
      s.ticket = null;
      const next = nextInQueue(s);
      ctx.changed();
      if (next) return ctx.load(next.key, next.key);
    },
  },
  cancelRound: {
    role: "dealer", schema: Commands.cancelRound,
    run({ s, changed, notice, claimTicket }, me) {
      if (s.phase === "waiting" && !s.ticket) return;
      if (s.phase === "settled") return; // already paid out; just pick the next ticket
      claimTicket();
      resetTable(s);
      s.ticket = null;
      notice("🎩 The dealer cancelled this round", { except: me.id });
      changed();
    },
  },
  skip: {
    role: "dealer", schema: Commands.skip,
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
  },
  kick: {
    role: "dealer", schema: Commands.kick,
    run({ s, changed, notice, remove }, me, { id }) {
      const p = s.players.find((x) => x.id === id);
      if (!p || p.id === me.id || p.id === s.dealerId) return;
      s.banned.push(p.token);
      remove(p, "Removed by the dealer");
      notice(`👋 ${p.name} was removed from the table`);
      changed();
    },
  },
};
