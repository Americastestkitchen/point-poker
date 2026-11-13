// Runs the title flow (flow.ts): holds its state, does the effects it asks for (asking the
// server, sitting down, tidying the address bar) and feeds the answers back in as events.
// The title screen reads it with useSyncExternalStore; node tests drive it with fake tables.
import type { OpenResult, Tables } from "../../app/tables.ts";
import { start, step, type SignedIn, type Step, type TitleEffect, type TitleEvent, type TitleState } from "./flow.ts";

/** What the title screens need from the page: the invite link, opening tables, sitting down. */
export interface Title {
  /** The table code from the invite link (`?room=`), or "" when the site was opened directly. */
  inviteCode: string;
  /** How the Jira sign-in you just came back from went (null: you didn't). */
  signedIn: SignedIn;
  /** Opening a table, and checking an invite's table is still open. */
  tables: Pick<Tables, "open" | "check" | "savedPasscode" | "host" | "signOut">;
  /** Leave for Atlassian's sign-in page; it comes back here to open the table. */
  signIn(): void;
  /** Sit down at table `code` with the saved profile: the game takes over from the title screens. */
  sit(code: string): void;
  /** Drop the invite from the address bar (its table is gone, or you went back to the menu). */
  forgetInvite(): void;
}

export interface TitleFlowDeps {
  title: Title;
  /** A name and look are saved already. */
  saved: boolean;
  /** Shows an error (the screen sends it through the event stream as a toast). */
  error(text: string): void;
}

/** The flow's event for how opening table request `request` went. */
function answer(request: number, r: OpenResult): TitleEvent {
  switch (r.t) {
    case "opened":
      return { t: "opened", request, code: r.code };
    case "passcode":
      return { t: "passcodeNeeded", request, tried: r.tried };
    case "signIn":
      return { t: "signInNeeded", request };
    case "pickSite":
      return { t: "sitesOffered", request, sites: r.sites };
    case "failed":
      return { t: "openFailed", request, reason: r.reason };
    default:
      return r satisfies never;
  }
}

export function createTitleFlow({ title, saved, error }: TitleFlowDeps) {
  const first = start(title.inviteCode, saved, title.signedIn);
  let state = first.state;
  let started = false;
  /** Answers only count while a screen is showing the flow. */
  let attached = false;
  const listeners = new Set<() => void>();

  function apply({ state: next, effects }: Step) {
    if (next !== state) {
      state = next;
      for (const l of [...listeners]) l();
    }
    for (const effect of effects) run(effect);
  }
  const dispatch = (e: TitleEvent) => {
    if (attached) apply(step(state, e));
  };

  function run(effect: TitleEffect) {
    switch (effect.t) {
      case "check":
        return void title.tables.check(effect.code).then((r) =>
          // if the server can't say, try the table anyway
          dispatch({ t: "checked", code: effect.code, open: r.t !== "gone" }),
        );
      case "open": {
        const { request } = effect;
        return void title.tables
          .open(effect.passcode ?? title.tables.savedPasscode(), effect.site ?? undefined)
          .then((r) => dispatch(answer(request, r)));
      }
      case "signIn":
        return title.signIn();
      case "sit":
        return title.sit(effect.code);
      case "forgetInvite":
        return title.forgetInvite();
      case "error":
        return error(effect.text);
      default:
        return effect satisfies never;
    }
  }

  return {
    getState: (): TitleState => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    dispatch,
    /** A screen shows the flow: answers count from now, and the first effects run (once ever). */
    attach() {
      attached = true;
      if (started) return;
      started = true;
      for (const effect of first.effects) run(effect);
    },
    /** The screen went away: answers still on their way are dropped. */
    detach() {
      attached = false;
    },
  };
}

export type TitleFlow = ReturnType<typeof createTitleFlow>;
