// Sitting down: the one step from the title screens to the table. It happens once per page
// (one table, one socket); leaving a table reloads the page.
import type { Session } from "./session.ts";
import type { Store } from "./store.ts";

export function createSit(deps: {
  store: Pick<Store, "getState" | "seated">;
  session: Pick<Session, "join">;
  /** Makes the address this table's invite link, so a reload brings you back to it. */
  showInvite(code: string): void;
}) {
  return (code: string) => {
    if (deps.store.getState().screen === "table") return;
    deps.showInvite(code);
    deps.store.seated();
    deps.session.join(code);
  };
}
