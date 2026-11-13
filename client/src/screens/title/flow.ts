// The title screens as a pure reducer, so node tests cover every path: the main menu, joining
// by code, opening a table (signing in with Jira, picking a Jira site, or the host passcode), character select, an invite link (with or
// without a saved profile), and an invite to a table that's gone.
//
// Every request is a view (checking a code, opening a table), and its answer only counts while
// you're still on the view that asked: going Back, asking twice or a late reply changes nothing.
// What to do outside the screen (ask the server, sit down, tidy the address bar, show an error)
// comes back as `effects` for TitleScreen to run; the answers come back in as events.
import type { JiraSite } from "../../../../shared/protocol.ts";
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

/** What opening a table is waiting on you for. */
export type OpenAsk =
  /** The host passcode; `wrong` once one didn't work. */
  | { t: "passcode"; wrong: boolean }
  /** Signing in with Jira (it leaves the page and comes back to open the table). */
  | { t: "signIn" }
  /** Which of your Jira sites the table uses. */
  | { t: "site"; sites: JiraSite[] };

/** How the Jira sign-in you came back from went (`?host=` in the address), if you did. */
export type SignedIn = "ok" | "failed" | null;

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
  /**
   * Opening a table: `sending` while the server's asked; `ask` once it wants something from you
   * first. `request` numbers the ask in flight, so only its own answer counts.
   */
  | { t: "opening"; sending: boolean; ask: OpenAsk | null; request: number }
  /** On the way to the table. */
  | { t: "sitting"; code: string };

export interface TitleState {
  view: TitleView;
  /** A name and look are saved: opening and joining go straight through, no character select. */
  saved: boolean;
  /** The table code in the address bar from an invite link, until you leave that invite. */
  invite: string | null;
  /** How many times a table was asked to open: each ask's number, to match its answer. */
  requests: number;
}

export type TitleEvent =
  /** The answer to a `check`, for an invite link's table or a typed code alike. */
  | { t: "checked"; code: string; open: boolean }
  | { t: "pick"; item: "open" | "join" | "character" }
  | { t: "codeEntered"; code: string }
  | { t: "changeLook" }
  | { t: "joinInvite" }
  /** Character select's Done: your profile is saved. */
  | { t: "done" }
  | { t: "back" }
  /** Answers to open request number `request`. */
  | { t: "opened"; request: number; code: string }
  /** The server wants a (different) host passcode; `tried` says whether one was sent. */
  | { t: "passcodeNeeded"; request: number; tried: boolean }
  /** The server wants you signed in with Jira first. */
  | { t: "signInNeeded"; request: number }
  /** You have more than one Jira site: pick one. */
  | { t: "sitesOffered"; request: number; sites: JiraSite[] }
  | { t: "openFailed"; request: number; reason: string }
  | { t: "passcodeEntered"; passcode: string }
  /** "Sign in with Jira" pressed. */
  | { t: "signIn" }
  | { t: "siteChosen"; site: string };

export type TitleEffect =
  /** Ask whether table `code` is open; answer with `checked`. */
  | { t: "check"; code: string }
  /** Open a table with this passcode (null: the one that worked last time) on Jira site `site`
   * (null: the one picked last time); answer with `opened`, `passcodeNeeded`, `signInNeeded`,
   * `sitesOffered` or `openFailed`, carrying `request`. */
  | { t: "open"; request: number; passcode: string | null; site: string | null }
  /** Leave for Atlassian's sign-in page; it comes back with `?host=`. */
  | { t: "signIn" }
  | { t: "sit"; code: string }
  /** Take the invite out of the address bar. */
  | { t: "forgetInvite" }
  | { t: "error"; text: string };

export interface Step {
  state: TitleState;
  effects: TitleEffect[];
}

export const SIGN_IN_FAILED = "Jira sign-in didn't finish, so no table was opened.";

/**
 * Where you land: the menu, checking an invite link's table first, or (back from signing in
 * with Jira, which you only do to open one) opening your table.
 */
export function start(invite: string, saved: boolean, signedIn: SignedIn = null): Step {
  const fresh: TitleState = { view: { t: "menu" }, saved, invite: null, requests: 0 };
  if (!invite && signedIn === "ok") return land(fresh, { t: "open" });
  if (!invite && signedIn === "failed") return { state: fresh, effects: [{ t: "error", text: SIGN_IN_FAILED }] };
  if (!invite) return { state: fresh, effects: [] };
  return {
    state: { view: { t: "checking", code: invite }, saved, invite, requests: 0 },
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
      if (view.t === "checking" && view.code === e.code) {
        if (!e.open) return go({ t: "gone", code: e.code });
        // with a profile: your bean and one "Join table" button; without: make one, then sit
        return state.saved ? go({ t: "invite", code: e.code }) : character({ t: "sit", code: e.code }, { t: "menu" });
      }
      if (view.t === "join" && view.checking === e.code) {
        if (!e.open) return go({ t: "join", checking: null, error: noTable(e.code) });
        return toward({ t: "sit", code: e.code }, { t: "join", checking: null, error: null });
      }
      return stay;
    case "pick":
      if (view.t !== "menu" && view.t !== "join") return stay;
      if (e.item === "join") return go({ t: "join", checking: null, error: null });
      if (e.item === "open") return toward({ t: "open" }, { t: "menu" });
      return character({ t: "menu" }, { t: "menu" });
    case "codeEntered":
      if (view.t !== "join" || view.checking || e.code.length !== TABLE_CODE.length) return stay;
      return go({ t: "join", checking: e.code, error: null }, { t: "check", code: e.code });
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
      if (!awaiting(view, e.request)) return stay;
      return go({ t: "sitting", code: e.code }, { t: "sit", code: e.code });
    case "passcodeNeeded":
      if (!awaiting(view, e.request)) return stay;
      return go({ ...view, sending: false, ask: { t: "passcode", wrong: e.tried } });
    case "signInNeeded":
      if (!awaiting(view, e.request)) return stay;
      return go({ ...view, sending: false, ask: { t: "signIn" } });
    case "sitesOffered":
      if (!awaiting(view, e.request)) return stay;
      return go({ ...view, sending: false, ask: { t: "site", sites: e.sites } });
    case "openFailed":
      if (!awaiting(view, e.request)) return stay;
      return go({ t: "menu" }, { t: "error", text: e.reason });
    case "passcodeEntered": {
      const passcode = e.passcode.trim();
      if (view.t !== "opening" || view.sending || view.ask?.t !== "passcode" || !passcode) return stay;
      return open(state, view.ask, { passcode });
    }
    case "signIn":
      if (view.t !== "opening" || view.ask?.t !== "signIn") return stay;
      return go({ ...view, sending: true }, { t: "signIn" });
    case "siteChosen":
      if (view.t !== "opening" || view.sending || view.ask?.t !== "site") return stay;
      if (!view.ask.sites.some((s) => s.id === e.site)) return stay;
      return open(state, view.ask, { site: e.site });
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
      return open(state, null, {});
    case "sit":
      return to({ t: "sitting", code: next.code }, { t: "sit", code: next.code });
    default:
      return next satisfies never;
  }
}

/** Ask the server to open a table, as a new numbered request (`ask`: the form that's up, if any). */
function open(state: TitleState, ask: OpenAsk | null, use: { passcode?: string; site?: string }): Step {
  const request = state.requests + 1;
  return settle({
    state: { ...state, requests: request, view: { t: "opening", sending: true, ask, request } },
    effects: [{ t: "open", request, passcode: use.passcode ?? null, site: use.site ?? null }],
  });
}

/** Is this view waiting for the answer to open request `request`? */
const awaiting = (view: TitleView, request: number): view is Extract<TitleView, { t: "opening" }> =>
  view.t === "opening" && view.sending && view.request === request;

/** Leaving an invite for the menu (or finding its table gone) takes it out of the address bar. */
function settle(s: Step): Step {
  const { view, invite } = s.state;
  const leftInvite = view.t === "menu" || view.t === "join" || view.t === "gone" || view.t === "opening";
  if (!invite || !leftInvite) return s;
  return { state: { ...s.state, invite: null }, effects: [...s.effects, { t: "forgetInvite" }] };
}
