// Places a table can be. Their 3D content lives in client/src/environments/<id>/.
import { byId, idsOf } from "./registry.ts";

export interface EnvironmentInfo {
  id: string;
  name: string;
}

export const ENVIRONMENTS = [
  { id: "basement", name: "The Backlog Basement" },
  { id: "beach", name: "Async Atoll" },
  { id: "diner", name: "Deploy Diner" },
] as const satisfies readonly EnvironmentInfo[];
export type EnvironmentId = (typeof ENVIRONMENTS)[number]["id"];
export const ENVIRONMENT_IDS = idsOf(ENVIRONMENTS);
export const ENVIRONMENT = byId(ENVIRONMENTS);
/** Where a new table opens, and where a room nobody here knows falls back to. */
export const DEFAULT_ENVIRONMENT: EnvironmentId = "basement";
