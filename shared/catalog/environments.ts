// Places a table can be. Their 3D content lives in client/src/environments/<id>/.
import { idsOf } from "./registry.ts";

export interface EnvironmentInfo {
  id: string;
  name: string;
}

export const ENVIRONMENTS = [
  { id: "basement", name: "The Backlog Basement" },
] as const satisfies readonly EnvironmentInfo[];
export type EnvironmentId = (typeof ENVIRONMENTS)[number]["id"];
export const ENVIRONMENT_IDS = idsOf(ENVIRONMENTS);
