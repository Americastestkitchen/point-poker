// Every environment, loaded only when a table needs it.
import type { EnvironmentId } from "../../../shared/catalog/environments.ts";
import type { Environment } from "./types.ts";

const ENVIRONMENTS: Record<EnvironmentId, () => Promise<{ default: Environment }>> = {
  basement: () => import("./basement/index.ts"),
  beach: () => import("./beach/index.ts"),
  diner: () => import("./diner/index.ts"),
  station: () => import("./station/index.ts"),
};

export async function loadEnvironment(id: EnvironmentId): Promise<Environment> {
  return (await ENVIRONMENTS[id]()).default;
}
