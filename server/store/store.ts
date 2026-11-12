// Where tables are kept between restarts.
import type { TableState } from "../table/state.ts";

export interface RoomStore {
  /** Saved tables. Ones that don't match today's format are dropped, so a format change starts fresh. */
  load(): TableState[];
  save(tables: TableState[]): void;
}
