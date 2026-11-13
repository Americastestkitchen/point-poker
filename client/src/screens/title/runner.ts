// Runs the title flow (flow.ts): holds its state, does the effects it asks for (asking the
// server, sitting down, tidying the address bar) and feeds the answers back in as events.
// The title screen reads it with useSyncExternalStore; node tests drive it with fake tables.
import type { Title } from "../game.tsx";
import { start, step, type Step, type TitleEffect, type TitleEvent, type TitleState } from "./flow.ts";

export interface TitleFlowDeps {
  title: Title;
  /** A name and look are saved already. */
  saved: boolean;
  /** Shows an error (the screen sends it through the event stream as a toast). */
  error(text: string): void;
}

export function createTitleFlow({ title, saved, error }: TitleFlowDeps) {
  const first = start(title.inviteCode, saved);
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
        // an invite link's table and a typed code ask the same thing: the flow takes the one it asked
        return void title.tables.check(effect.code).then((r) => {
          const open = r.t !== "gone"; // if the server can't say, try the table anyway
          dispatch({ t: "checked", code: effect.code, open });
          dispatch({ t: "codeChecked", code: effect.code, open });
        });
      case "open": {
        const { request } = effect;
        return void title.tables
          .open(effect.passcode ?? title.tables.savedPasscode())
          .then((r) =>
            dispatch(
              r.t === "opened"
                ? { t: "opened", request, code: r.code }
                : r.t === "passcode"
                  ? { t: "passcodeNeeded", request, tried: r.tried }
                  : { t: "openFailed", request, reason: r.reason },
            ),
          );
      }
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
