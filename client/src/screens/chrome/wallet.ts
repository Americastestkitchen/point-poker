// Your wallet in the top bar. It shows your chips; when a settle pays you, the old amount stays
// up while coins burst out of the middle of the screen and stream into it, and it counts up
// (CoinCounter rolls and bumps) when the first one lands. The coins are plain elements animated
// with the Web Animations API: their positions never touch React state.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { myPlayer } from "../../app/store.ts";
import { useUi } from "../../ui/index.ts";
import { useAppState, useGame } from "../game.tsx";
import { useViewChanges } from "../moments.ts";
import { BURST_DELAY_MS, burstSize, clinks, coinFlight, walletWin, type Point } from "./model.ts";

interface BurstDeps {
  /** Where the coins are added (the UI layer, so they fly over the HUD and popups). */
  parent: HTMLElement;
  /** The coin's look (fixed position, over --pp-layer-burst). */
  className: string;
  from: Point;
  to: Point;
  amount: number;
  /** A coin reached the wallet; `landed` counts them from 1. */
  onLand(landed: number): void;
}

/** Fires the coins. Returns a cancel that stops them and takes them off the screen. */
function coinBurst({ parent, className, from, to, amount, onLand }: BurstDeps): () => void {
  const flights: { el: HTMLElement; anim: Animation }[] = [];
  let landed = 0;
  const n = burstSize(amount);
  for (let i = 0; i < n; i++) {
    const el = parent.ownerDocument.createElement("div");
    el.className = className;
    el.setAttribute("aria-hidden", "true");
    parent.append(el);
    const { keyframes, timing } = coinFlight(i, from, to, Math.random() * Math.PI * 2, 60 + Math.random() * 120);
    const anim = el.animate(keyframes, timing);
    anim.onfinish = () => {
      el.remove();
      onLand(++landed);
    };
    flights.push({ el, anim });
  }
  return () => {
    for (const f of flights) {
      f.anim.onfinish = null;
      f.anim.cancel();
      f.el.remove();
    }
  };
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The amount the wallet shows. `target` is what the coins fly into; `coinClass` is their look.
 * Without a seat yet it's null (the top bar leaves the wallet out until it has one).
 */
export function useWallet(target: RefObject<HTMLElement | null>, coinClass: string): number | null {
  const { audio } = useGame();
  const { layer } = useUi();
  const chips = useAppState((s) => myPlayer(s)?.chips);
  // the old amount, held up while your winnings are in the air (transient animation state)
  const [held, setHeld] = useState<number | null>(null);
  const shown = held ?? chips ?? null;
  const lastShown = useRef(shown);
  useLayoutEffect(() => { lastShown.current = shown; });

  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);

  useViewChanges((change, s) => {
    if (change.t !== "settled" || !s.room) return;
    const amount = walletWin([change], s.room, s.me?.id);
    // a new call replaces any burst still on its way (the dealer changed their mind)
    stop.current();
    stop.current = () => {};
    if (amount === null) return setHeld(null);
    // still showing the old amount: hold it until the coins land
    if (lastShown.current !== null) setHeld(lastShown.current);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelFlight = () => {};
    const release = () => setHeld(null);
    timers.push(setTimeout(() => {
      audio.win();
      const el = target.current;
      if (!el || reducedMotion()) return release();
      const r = el.getBoundingClientRect();
      const doc = el.ownerDocument;
      const view = doc.defaultView;
      cancelFlight = coinBurst({
        parent: layer ?? doc.body,
        className: coinClass,
        from: { x: (view?.innerWidth ?? 0) / 2, y: (view?.innerHeight ?? 0) * 0.42 },
        // the coin sits at the counter's left end
        to: { x: r.left + 17, y: r.top + r.height / 2 },
        amount,
        onLand(landed) {
          if (landed === 1) release();
          if (clinks(landed)) audio.chip();
        },
      });
      // if the coins never get there (a hidden tab), the wallet still catches up
      timers.push(setTimeout(release, 2500));
    }, BURST_DELAY_MS));
    stop.current = () => {
      for (const t of timers) clearTimeout(t);
      cancelFlight();
    };
  });

  return shown;
}
