// Big moments over the room (region "announce", upper middle; never takes the pointer): "New
// ticket" on a deal, "Cards up!" or the consensus on the reveal (with the flip sound), and who
// takes the pot on the call. They pass over the table, they don't stay on it; a newer one
// replaces the one showing. announce.ts decides the words.
// Legacy parity: hud.ts announce(), celebrate() and react() for dealt / revealed / settled.
// (The coin burst into the wallet is chrome's, in TopBar.)
import { useEffect, useRef, useState } from "react";
import { cx } from "../../ui/index.ts";
import { useGame } from "../game.tsx";
import { useViewChanges } from "../moments.ts";
import { announcementFor, type Announcement } from "./announce.ts";
import s from "./Announcements.module.css";

/** How long the card takes to leave (its CSS animation). */
const LEAVE_MS = 400;

interface Shown {
  id: number;
  a: Announcement;
  leaving: boolean;
}

export function Announcements() {
  const { audio } = useGame();
  // transient animation state: which card is up, and whether it's on its way out
  const [shown, setShown] = useState<Shown | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);

  const clear = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => clear, []);

  useViewChanges((change, state) => {
    if (change.t === "revealed") audio.flip();
    const a = state.room && announcementFor(change, state.room, state.me?.id);
    if (!a) return;
    clear();
    const id = ++seq.current;
    setShown({ id, a, leaving: false });
    timers.current.push(setTimeout(() => {
      setShown((cur) => (cur?.id === id ? { ...cur, leaving: true } : cur));
      timers.current.push(setTimeout(() => setShown((cur) => (cur?.id === id ? null : cur)), LEAVE_MS));
    }, a.ms));
  });

  return (
    <div className={s.layer} aria-live="polite">
      {shown && <Card key={shown.id} a={shown.a} leaving={shown.leaving} />}
    </div>
  );
}

function Card({ a, leaving }: { a: Announcement; leaving: boolean }) {
  return (
    <div className={cx(s.card, s[a.kind], a.mine && s.mine, leaving && s.leaving)}>
      {a.kicker && <div className={s.kicker}>{a.kicker}</div>}
      <div className={cx(s.title, a.amount !== null && s.win)}>
        {a.title}
        {a.amount !== null && <> <span className={s.amount}>+{a.amount}</span></>}
      </div>
      <div className={s.sub}>{a.sub}</div>
    </div>
  );
}
