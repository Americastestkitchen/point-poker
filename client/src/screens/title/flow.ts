// Where the title screens are and where each choice leads, as a pure reducer so node tests
// cover every path: the main menu, joining by code, character select, an invite link (with or
// without a saved profile), and an invite to a table that's gone. Sitting down and opening a
// table are side effects the screen runs when the reducer says so (`go`).

/** What happens once character select is done (or straight away, with a saved profile). */
export type Next =
  | { t: "menu" }
  /** Open a new table and deal it. */
  | { t: "open" }
  /** Sit down at table `code`. */
  | { t: "sit"; code: string }
  /** Back to the invite for table `code`. */
  | { t: "invite"; code: string };

export type View =
  /** Asking the server whether the invite's table is still open. */
  | { t: "checking"; code: string }
  | { t: "menu" }
  /** Typing a table code; `error` says why the last one didn't work. */
  | { t: "join"; error: string | null }
  /** Character select: Done leads to `next`, Back to `back`. */
  | { t: "character"; next: Next; back: View }
  /** An invite link, with a saved profile: one click to sit down. */
  | { t: "invite"; code: string }
  /** An invite to a table that's no longer open. */
  | { t: "gone"; code: string };

export type Event =
  | { t: "checked"; code: string; open: boolean }
  | { t: "pick"; item: "open" | "join" | "character" }
  | { t: "joinTyped"; code: string; open: boolean }
  | { t: "changeLook" }
  | { t: "joinInvite" }
  | { t: "done" }
  | { t: "back" };

/** The new view, and the side effect to run (open a table or sit down), if any. */
export interface Step {
  view: View;
  go: Extract<Next, { t: "open" } | { t: "sit" }> | null;
}

/** Where you land: the menu, or checking an invite link's table first. */
export function start(invite: string): View {
  return invite ? { t: "checking", code: invite } : { t: "menu" };
}

/**
 * `hasProfile`: a name and look are saved, so opening and joining go straight through;
 * without one, character select comes first.
 */
export function step(view: View, e: Event, hasProfile: boolean): Step {
  const stay: Step = { view, go: null };
  /** Run `next`, through character select first if there's no profile yet. */
  const toward = (next: Next, back: View): Step =>
    hasProfile ? land(next) : { view: { t: "character", next: next, back }, go: null };

  switch (e.t) {
    case "checked":
      if (view.t !== "checking" || view.code !== e.code) return stay;
      if (!e.open) return { view: { t: "gone", code: e.code }, go: null };
      // with a profile: your bean and one "Join table" button; without: make one, then sit
      if (hasProfile) return { view: { t: "invite", code: e.code }, go: null };
      return { view: { t: "character", next: { t: "sit", code: e.code }, back: { t: "menu" } }, go: null };
    case "pick":
      if (view.t !== "menu" && view.t !== "join") return stay;
      if (e.item === "join") return { view: { t: "join", error: null }, go: null };
      if (e.item === "open") return toward({ t: "open" }, { t: "menu" });
      return { view: { t: "character", next: { t: "menu" }, back: { t: "menu" } }, go: null };
    case "joinTyped":
      if (view.t !== "join") return stay;
      if (!e.open) return { view: { t: "join", error: `There's no table ${e.code} open.` }, go: null };
      return toward({ t: "sit", code: e.code }, view);
    case "changeLook":
      if (view.t !== "invite") return stay;
      return { view: { t: "character", next: { t: "invite", code: view.code }, back: view }, go: null };
    case "joinInvite":
      return view.t === "invite" ? land({ t: "sit", code: view.code }) : stay;
    case "done":
      return view.t === "character" ? land(view.next) : stay;
    case "back":
      if (view.t === "character") return { view: view.back, go: null };
      if (view.t === "join" || view.t === "gone") return { view: { t: "menu" }, go: null };
      return stay;
    default:
      return e satisfies never;
  }
}

/** Arrive at `next`: a view, or a side effect that leaves the title screens. */
function land(next: Next): Step {
  switch (next.t) {
    case "menu":
      return { view: { t: "menu" }, go: null };
    case "invite":
      return { view: { t: "invite", code: next.code }, go: null };
    case "open":
    case "sit":
      return { view: { t: "menu" }, go: next };
    default:
      return next satisfies never;
  }
}

/** Table codes are four letters. */
export const CODE_LENGTH = 4;
