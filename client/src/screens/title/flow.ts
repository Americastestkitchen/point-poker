// The title screens as a pure reducer, so node tests cover every path: the main menu, joining
// by code, opening a table (and the host passcode), character select, an invite link (with or
// without a saved profile), and an invite to a table that's gone.
//
// Every request is a view (checking a code, opening a table), and its answer only counts while
// you're still on the view that asked: going Back, asking twice or a late reply changes nothing.
// What to do outside the screen (ask the server, sit down, tidy the address bar, show an error)
// comes back as `effects` for TitleScreen to run; the answers come back in as events.
import { TABLE_CODE } from "../../../../shared/rules.ts";

/** Where character select (or a saved profile) leads. */
export type Next =
  | { t: "menu" }
  /** Open a new table and deal it. */
  | { t: "open" }
  /** Sit down at table `code`. */
  | { t: "sit"; code: string }
  /** Back to the invite for table `code`. */
  | { t: "invite"; code: string };

export type TitleView =
  /** Asking the server whether the invite link's table is still open. */
  | { t: "checking"; code: string }
  | { t: "menu" }
  /** Typing a table code: `checking` while asking about one, `error` why the last didn't work. */
  | { t: "join"; checking: string | null; error: string | null }
  /** Character select: Done leads to `next`, Back to `back`. */
  | { t: "character"; next: Next; back: TitleView }
  /** An invite link, with a saved profile: one click to sit down. */
  | { t: "invite"; code: string }
  /** An invite to a table that's no longer open. */
  | { t: "gone"; code: string }
  /** Opening a table: `sending` while the server's asked; `passcode` once it wants the host passcode. */
  | { t: "opening"; sending: boolean; passcode: { wrong: boolean } | null }
  /** On the way to the table. */
  | { t: "sitting"; code: string };

export interface TitleState {
  view: TitleView;
  /** A name and look are saved: opening and joining go straight through, no character select. */
  saved: boolean;
  /** The table code in the address bar from an invite link, until you leave that invite. */
  invite: string | null;
}

export type TitleEvent =
  | { t: "checked"; code: string; open: boolean }
  | { t: "pick"; item: "open" | "join" | "character" }
  | { t: "codeEntered"; code: string }
  | { t: "codeChecked"; code: string; open: boolean }
  | { t: "changeLook" }
  | { t: "joinInvite" }
  /** Character select's Done: your profile is saved. */
  | { t: "done" }
  | { t: "back" }
  | { t: "opened"; code: string }
  /** The server wants a (different) host passcode; `tried` says whether one was sent. */
  | { t: "passcodeNeeded"; tried: boolean }
  | { t: "openFailed"; reason: string }
  | { t: "passcodeEntered"; passcode: string };

export type TitleEffect =
  /** Ask whether table `code` is open; answer with `checked` (invite) or `codeChecked` (typed). */
  | { t: "check"; code: string }
  /** Open a table with this passcode (null: the one that worked last time); answer with
   * `opened`, `passcodeNeeded` or `openFailed`. */
  | { t: "open"; passcode: string | null }
  | { t: "sit"; code: string }
  /** Take the invite out of the address bar. */
  | { t: "forgetInvite" }
  | { t: "error"; text: string };

export interface Step {
  state: TitleState;
  effects: TitleEffect[];
}

/** Where you land: the menu, or checking an invite link's table first. */
export function start(invite: string, saved: boolean): Step {
  if (!invite) return { state: { view: { t: "menu" }, saved, invite: null }, effects: [] };
  return {
    state: { view: { t: "checking", code: invite }, saved, invite },
    effects: [{ t: "check", code: invite }],
  };
}

export const noTable = (code: string) => `There's no table ${code} open.`;

export function step(state: TitleState, e: TitleEvent): Step {
  const { view } = state;
  const stay: Step = { state, effects: [] };
  const go = (next: TitleView, ...effects: TitleEffect[]): Step => settle({ state: { ...state, view: next }, effects });
  const character = (next: Next, back: TitleView) => go({ t: "character", next, back });
  /** Run `next`, through character select first while there's no profile. */
  const toward = (next: Next, back: TitleView) => (state.saved ? land(state, next) : character(next, back));

  switch (e.t) {
    case "checked":
      if (view.t !== "checking" || view.code !== e.code) return stay;
      if (!e.open) return go({ t: "gone", code: e.code });
      // with a profile: your bean and one "Join table" button; without: make one, then sit
      return state.saved ? go({ t: "invite", code: e.code }) : character({ t: "sit", code: e.code }, { t: "menu" });
    case "pick":
      if (view.t !== "menu" && view.t !== "join") return stay;
      if (e.item === "join") return go({ t: "join", checking: null, error: null });
      if (e.item === "open") return toward({ t: "open" }, { t: "menu" });
      return character({ t: "menu" }, { t: "menu" });
    case "codeEntered":
      if (view.t !== "join" || view.checking || e.code.length !== TABLE_CODE.length) return stay;
      return go({ t: "join", checking: e.code, error: null }, { t: "check", code: e.code });
    case "codeChecked":
      if (view.t !== "join" || view.checking !== e.code) return stay;
      if (!e.open) return go({ t: "join", checking: null, error: noTable(e.code) });
      return toward({ t: "sit", code: e.code }, { t: "join", checking: null, error: null });
    case "changeLook":
      if (view.t !== "invite") return stay;
      return character({ t: "invite", code: view.code }, view);
    case "joinInvite":
      return view.t === "invite" ? land(state, { t: "sit", code: view.code }) : stay;
    case "done":
      return view.t === "character" ? land({ ...state, saved: true }, view.next) : stay;
    case "back":
      if (view.t === "character") return go(view.back);
      if (view.t === "join" || view.t === "gone" || view.t === "opening") return go({ t: "menu" });
      return stay;
    case "opened":
      if (view.t !== "opening" || !view.sending) return stay;
      return go({ t: "sitting", code: e.code }, { t: "sit", code: e.code });
    case "passcodeNeeded":
      if (view.t !== "opening" || !view.sending) return stay;
      return go({ t: "opening", sending: false, passcode: { wrong: e.tried } });
    case "openFailed":
      if (view.t !== "opening" || !view.sending) return stay;
      return go({ t: "menu" }, { t: "error", text: e.reason });
    case "passcodeEntered": {
      const passcode = e.passcode.trim();
      if (view.t !== "opening" || view.sending || !passcode) return stay;
      return go({ ...view, sending: true }, { t: "open", passcode });
    }
    default:
      return e satisfies never;
  }
}

/** Arrive at `next`: a view, or on the way out of the title screens. */
function land(state: TitleState, next: Next): Step {
  const to = (view: TitleView, ...effects: TitleEffect[]) => settle({ state: { ...state, view }, effects });
  switch (next.t) {
    case "menu":
      return to({ t: "menu" });
    case "invite":
      return to({ t: "invite", code: next.code });
    case "open":
      return to({ t: "opening", sending: true, passcode: null }, { t: "open", passcode: null });
    case "sit":
      return to({ t: "sitting", code: next.code }, { t: "sit", code: next.code });
    default:
      return next satisfies never;
  }
}

/** Leaving an invite for the menu (or finding its table gone) takes it out of the address bar. */
function settle(s: Step): Step {
  const { view, invite } = s.state;
  const leftInvite = view.t === "menu" || view.t === "join" || view.t === "gone" || view.t === "opening";
  if (!invite || !leftInvite) return s;
  return { state: { ...s.state, invite: null }, effects: [...s.effects, { t: "forgetInvite" }] };
}
