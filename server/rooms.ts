// The open tables, by code.
import { randomBytes, randomUUID } from "node:crypto";
import { TABLE_CODE } from "../shared/rules.ts";
import { newTableState, type TableJira, type TableState } from "./table/state.ts";
import { Table, type TableDeps } from "./table/table.ts";

export class Rooms {
  private readonly tables = new Map<string, Table>();
  private readonly deps: TableDeps;

  constructor(deps: TableDeps, saved: TableState[] = []) {
    this.deps = deps;
    for (const s of saved) this.tables.set(s.code, new Table(s, deps));
  }

  get size() {
    return this.tables.size;
  }
  get(code: string) {
    return this.tables.get(code.toUpperCase());
  }

  /** Opens a table; `jira` is the dealer's Jira login it loads tickets with, if any. */
  create(jira: TableJira | null = null): Table {
    const { letters, length } = TABLE_CODE;
    let code;
    do code = Array.from(randomBytes(length), (b) => letters[b % letters.length]).join("");
    while (this.tables.has(code));
    const table = new Table(newTableState(code, randomUUID(), this.deps.now(), jira), this.deps);
    this.tables.set(code, table);
    return table;
  }

  snapshot(): TableState[] {
    return [...this.tables.values()].map((t) => t.snapshot());
  }

  /** Forgets tables nobody is connected to and nobody has touched for `idleMs`. */
  sweep(idleMs: number) {
    const cutoff = this.deps.now() - idleMs;
    for (const [code, table] of this.tables) {
      if (!table.connected && table.lastActive < cutoff) this.tables.delete(code);
    }
  }
}
