// One poker table. It owns the round's state and rules; transport/ moves
// messages in and out, and adapters (tickets, clock, log) come in as deps.
import { randomUUID } from "node:crypto";
import { validateLook } from "../../shared/look.ts";
import type { Command, JoinMsg, TableView } from "../../shared/protocol.ts";
import type { TicketSource } from "../tickets/source.ts";
import { COMMANDS, type CommandSpec, type Ctx } from "./commands.ts";
import { clean, findPlayer, freeSeat, startRound } from "./rules.ts";
import type { TableState } from "./state.ts";
import { viewFor } from "./view.ts";

export interface Log {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface TableDeps {
  ticketsFor(dealerId: string): TicketSource;
  now(): number;
  random(): number;
  log: Log;
}

/** Effects that change no state; the transport plays them to everyone at the table. */
export type TableFx =
  | { kind: "adjust"; id: string }
  | { kind: "flick"; from: string; to: string };

export type TableEvent =
  /** The state changed: send everyone a fresh view. */
  | { t: "changed" }
  | { t: "notice"; text: string; level?: "error"; except?: string }
  | { t: "fx"; fx: TableFx; except?: string }
  /** A player was removed (kicked); close their connection. */
  | { t: "removed"; playerId: string; reason: string };

export type JoinRequest = Omit<JoinMsg, "t">;
export type JoinResult =
  | { ok: true; playerId: string; token: string; isDealer: boolean }
  | { ok: false; code: 4001 | 4003; reason: string; text?: string };

export interface CommandResult { error?: string }

export const ROLE_ERROR = "Only the dealer can do that";

export class Table {
  private readonly s: TableState;
  private readonly deps: TableDeps;
  private readonly online = new Set<string>();
  private readonly listeners = new Set<(e: TableEvent) => void>();
  /** When each player last did something with a cooldown ("id:what" → ms). Not saved. */
  private readonly lastUsed = new Map<string, number>();
  private ticketSeq = 0;
  private queueSeq = 0;
  private readonly ctx: Ctx;

  constructor(state: TableState, deps: TableDeps) {
    this.s = state;
    this.deps = deps;
    const emit = (e: TableEvent) => { for (const l of [...this.listeners]) l(e); };
    this.ctx = {
      s: state,
      now: () => deps.now(),
      log: (line) => deps.log.info(line),
      changed: () => emit({ t: "changed" }),
      notice: (text, opts = {}) => emit({ t: "notice", text, ...opts }),
      fx: (fx, except) => emit({ t: "fx", fx, except }),
      remove: (p, reason) => {
        this.s.players = this.s.players.filter((x) => x !== p);
        this.online.delete(p.id);
        emit({ t: "removed", playerId: p.id, reason });
      },
      ready: (playerId, what, cooldownMs) => {
        const key = `${playerId}:${what}`, now = deps.now();
        if (now - (this.lastUsed.get(key) ?? -Infinity) < cooldownMs) return false;
        this.lastUsed.set(key, now);
        return true;
      },
      claimTicket: () => { const seq = ++this.ticketSeq; return () => seq === this.ticketSeq; },
      claimQueue: () => { const seq = ++this.queueSeq; return () => seq === this.queueSeq; },
      load: (ref, label) => this.load(ref, label),
      upcoming: (project) => this.tickets().find({ kind: "upcoming", project }),
    };
  }

  get code() { return this.s.code; }
  /** How many players have a live connection. */
  get connected() { return this.online.size; }
  get lastActive() { return this.s.lastActive; }

  /** Listen for state changes and effects; returns a function that stops listening. */
  on(listener: (e: TableEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Seats a new player, or reconnects one by seat token (or dealer key). */
  join(req: JoinRequest): JoinResult {
    const s = this.s;
    const isDealer = !!req.dealerKey && req.dealerKey === s.dealerKey;
    if (!isDealer && req.token && s.banned.includes(req.token)) return { ok: false, code: 4001, reason: "Removed by the dealer" };
    let me = s.players.find((p) => (!!req.token && p.token === req.token) || (isDealer && p.id === s.dealerId));
    if (!me) {
      const seat = isDealer ? -1 : freeSeat(s);
      if (seat === -2) return { ok: false, code: 4003, reason: "Table full", text: "The table is full" };
      me = { id: this.newId(), token: randomUUID(), name: "", look: validateLook(undefined), seat, vote: null, chips: 0, lastWin: 0 };
      s.players.push(me);
      if (isDealer) s.dealerId = me.id;
    }
    const dealer = me.id === s.dealerId;
    me.name = clean(req.name, 18) || (dealer ? "Dealer" : "Mystery Bean");
    me.look = validateLook(req.look);
    this.online.add(me.id);
    s.lastActive = this.deps.now();
    this.ctx.changed();
    return { ok: true, playerId: me.id, token: me.token, isDealer: dealer };
  }

  /** The player's connection dropped; they keep their seat. */
  disconnect(playerId: string) {
    if (!this.online.delete(playerId)) return;
    this.s.lastActive = this.deps.now();
    this.ctx.changed();
  }

  /** Runs a command: checks its shape, the player's role and the phase, then applies the rules. */
  async run(playerId: string, cmd: Command): Promise<CommandResult> {
    const me = findPlayer(this.s, playerId);
    if (!me) return { error: "You're not at this table" };
    const spec = (COMMANDS as Record<string, CommandSpec<Command> | undefined>)[cmd?.t];
    if (!spec) return { error: "Unknown command" };
    const parsed = spec.schema.safeParse(cmd);
    if (!parsed.success) return { error: "That command didn't make sense" };
    if (spec.role === "dealer" && me.id !== this.s.dealerId) return { error: ROLE_ERROR };
    this.s.lastActive = this.deps.now();
    try {
      const error = await spec.run(this.ctx, me, parsed.data);
      return error ? { error } : {};
    } catch (e) {
      this.deps.log.error("command failed", cmd.t, e);
      return { error: "Something went wrong" };
    }
  }

  /** What this player may see: everything public, plus their own card. */
  viewFor(playerId: string | null): TableView {
    return viewFor(this.s, playerId, this.online, this.tickets().enabled);
  }

  /** The whole state as plain JSON, for saving. */
  snapshot(): TableState {
    return structuredClone(this.s);
  }

  private tickets() {
    return this.deps.ticketsFor(this.s.dealerId ?? "");
  }

  private newId() {
    let id = "";
    do id = Math.floor(this.deps.random() * 2 ** 32).toString(16).padStart(8, "0");
    while (findPlayer(this.s, id));
    return id;
  }

  /** Loads a ticket and deals it. An epic fills the queue with its children and deals the first one. Latest load wins. */
  private async load(ref: string, label: string): Promise<string | void> {
    const s = this.s;
    const current = this.ctx.claimTicket();
    const tickets = this.tickets();
    try {
      let ticket = await tickets.get(ref);
      if (!current()) return;
      if (ticket.type.toLowerCase() === "epic") {
        const currentQueue = this.ctx.claimQueue();
        const children = await tickets.find({ kind: "epic", key: ticket.key });
        if (!current()) return;
        if (children.tickets.length === 0) throw new Error("That epic has no child tickets");
        if (currentQueue()) {
          s.epic = { key: ticket.key, summary: ticket.summary, url: ticket.url };
          s.queue = children.tickets;
          s.queueLabel = children.label;
          this.ctx.changed();
        }
        const first = children.tickets.find((c) => c.points === null) ?? children.tickets[0];
        ticket = await tickets.get(first.key);
        if (!current()) return;
      }
      s.ticket = ticket;
      startRound(s);
      this.ctx.changed();
    } catch (e) {
      if (current()) return `${label}: ${(e as Error).message}`;
    }
  }
}
