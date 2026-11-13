// Places a table can be. Their 3D content lives in client/src/environments/<id>/.
export const ENVIRONMENTS = [
  { id: "basement", name: "The Backlog Basement" },
] as const;
export type EnvironmentId = (typeof ENVIRONMENTS)[number]["id"];
export const ENVIRONMENT_IDS = ENVIRONMENTS.map((e) => e.id) as [EnvironmentId, ...EnvironmentId[]];
