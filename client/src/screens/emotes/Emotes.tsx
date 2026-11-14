// Emotes beyond the four on Z X C V: the 😀 slot at the top of the hotbar opens a wheel of them
// (as does E, from the world's keys: hold it, flick the mouse towards one, let go). When someone
// else emotes, the slot nudges you for a few seconds: opening the wheel then answers them, and
// your emoji flies over to them. The wheel's hub says who it's for, and switches it to everyone.
import { useEffect, useRef, useState } from "react";
import { EMOTE_WHEEL_KEY, EMOTES } from "../../../../shared/catalog/emotes.ts";
import { Button, cx, Wheel } from "../../ui/index.ts";
import { useAppState, useGame, usePopup, useRoom } from "../game.tsx";
import { useGameEvents } from "../moments.ts";
import { useLetGoAfterTouch } from "../parts/touch.ts";
import { offeredBy, offerFrom, offerText, REPLY_MS, type Offer } from "./reply.ts";
import s from "./Emotes.module.css";

const WHEEL = EMOTES.map((e) => ({ id: e.id, icon: e.emoji, label: e.name }));

export function EmoteSlot() {
  const { actions, store } = useGame();
  const popup = usePopup("emotes");
  const players = useRoom()?.players ?? [];
  const meId = useAppState((st) => st.me?.id);
  // transient: the emote you could answer (it lapses by itself), and whether you'd rather not
  const [offer, setOffer] = useState<(Offer & { n: number }) | null>(null);
  const [toEveryone, setToEveryone] = useState(false);
  const offers = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wheelOpen = () => store.getState().ui.popup === "emotes";

  useGameEvents((e) => {
    const next = offerFrom(e, meId);
    // who the open wheel answers doesn't change under your hand
    if (!next || wheelOpen()) return;
    setOffer({ ...next, n: ++offers.current });
    setToEveryone(false);
    clearTimeout(timer.current);
    const lapse = () => {
      // not while you're choosing your answer: it lapses once the wheel is shut
      if (wheelOpen()) timer.current = setTimeout(lapse, 500);
      else setOffer(null);
    };
    timer.current = setTimeout(lapse, REPLY_MS);
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const from = offeredBy(offer, players);
  const to = toEveryone ? null : from;
  const tap = useLetGoAfterTouch(popup.show);
  /** The wheel shut, with or without an answer: the offer has had its turn. */
  const done = () => {
    popup.close();
    clearTimeout(timer.current);
    setOffer(null);
    setToEveryone(false);
  };

  return (
    <>
      <span className={s.wrap}>
        {/* who just emoted, said once beside the slot; it fades by itself */}
        {offer && from && !popup.open && (
          <span key={offer.n} className={s.nudge} aria-hidden>
            <b>{offerText(offer, from)}</b>
            <span>answer?</span>
          </span>
        )}
        <Button
          {...tap}
          shape="round"
          size="md"
          className={cx(s.slot, offer && from && s.asking)}
          aria-label={from ? `Emotes: answer ${from.name}` : "Emotes"}
          aria-keyshortcuts={EMOTE_WHEEL_KEY}
          title={from ? `Answer ${from.name}'s emote` : "Emotes"}
        >
          <span aria-hidden>😀</span>
        </Button>
        {/* outside the button, so it sits on the rim like the hand items' keys */}
        <kbd className={s.key} aria-hidden>
          {EMOTE_WHEEL_KEY.toUpperCase()}
        </kbd>
      </span>
      <Wheel
        open={popup.open}
        onClose={done}
        label={to ? `Emotes, for ${to.name}` : "Emotes"}
        items={WHEEL}
        holdKey={EMOTE_WHEEL_KEY}
        onPick={(emote) => {
          actions.emote(emote, to?.id);
          done();
        }}
      >
        {from ? (
          <Button
            variant="ghost"
            size="sm"
            shape="pill"
            className={s.to}
            aria-pressed={!toEveryone}
            aria-label={`Just for ${from.name}`}
            onPress={() => setToEveryone((now) => !now)}
          >
            {toEveryone ? "For everyone" : `↩ For ${from.name}`}
          </Button>
        ) : (
          <span>For everyone</span>
        )}
      </Wheel>
    </>
  );
}
