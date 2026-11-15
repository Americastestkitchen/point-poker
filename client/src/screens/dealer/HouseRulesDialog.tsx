// The house rules (popup "rules"), the dealer's: which cards the table plays with (a scale or
// the dealer's own cards, plus the "?" and "☕" extras), whether the dealer plays a card too,
// and which room the table is in. Everyone sees a change as it's made, and the dealer's next
// table opens the same way. The cards only change between tickets; the rest changes any time.
// Opened from the lobby's dock and from Dealer controls. Dealer only: it follows the role.
// What shows and what's allowed is decided in rules.ts.
import { useEffect, useState } from "react";
import { buildDeck, choiceOf, EXTRA_CARDS } from "../../../../shared/catalog/decks.ts";
import { ENVIRONMENT, ENVIRONMENT_IDS } from "../../../../shared/catalog/environments.ts";
import type { DeckChoice } from "../../../../shared/protocol.ts";
import { Button, Carousel, Dialog, TextField, Toggle } from "../../ui/index.ts";
import { useGame, useMe, usePopup, useRoom } from "../game.tsx";
import {
  cardsLocked,
  OWN_HINT,
  ownText,
  SCALE_OPTIONS,
  scaleLabels,
  scaleName,
  TOO_FEW,
  typedCards,
  type ScaleOption,
} from "./rules.ts";
import s from "./HouseRulesDialog.module.css";

export function HouseRulesDialog() {
  const { store } = useGame();
  const popup = usePopup("rules");
  const isDealer = useMe()?.isDealer ?? false;
  // the role moved away while it was open: let it go, so Esc and the other popups work again
  useEffect(() => {
    if (popup.open && !isDealer) store.popupClosed("rules");
  }, [store, popup.open, isDealer]);
  if (!isDealer) return null;
  return (
    <Dialog
      open={popup.open}
      onClose={popup.close}
      title="🃏 House rules"
      width="sm"
      actions={
        <Button variant="primary" onPress={popup.close}>
          Done
        </Button>
      }
    >
      <RulesBody />
    </Dialog>
  );
}

/** Mounted only while the popup is open, so half-typed cards are gone next time. */
function RulesBody() {
  const { actions } = useGame();
  const room = useRoom();
  // What's typed in "your cards" while the dealer rolls their own; null while a named scale is picked.
  // It's a draft: the table's deck stays the truth, and only cards that make a deck are sent.
  const [own, setOwn] = useState<string | null>(() => {
    const deck = room?.settings.deck ?? [];
    return choiceOf(deck).scale === "custom" ? ownText(deck) : null;
  });
  const [tooFew, setTooFew] = useState(false);
  if (!room) return null;

  const deck = room.settings.deck;
  const choice = choiceOf(deck);
  const locked = cardsLocked(room.phase);
  const scale: ScaleOption = own === null ? choice.scale : "custom";
  const deal = (next: DeckChoice) => actions.dealer.setDeck(next);

  const pickScale = (id: ScaleOption) => {
    setTooFew(false);
    if (id === "custom") return setOwn(ownText(deck));
    setOwn(null);
    deal({ ...choice, scale: id, cards: [] });
  };
  const dealOwn = () => {
    const next: DeckChoice = { ...choice, scale: "custom", cards: typedCards(own ?? "") };
    if (!buildDeck(next)) return setTooFew(true);
    setTooFew(false);
    deal(next);
  };

  return (
    <div className={s.list}>
      <Carousel
        label="🂠 Cards"
        options={SCALE_OPTIONS}
        value={scale}
        onChange={pickScale}
        disabled={!!locked}
        render={(id) => (
          <span className={s.scale}>
            <span>{scaleName(id)}</span>
            <span className={s.cards}>
              {scaleLabels(id, own ?? "").map((label) => (
                <span key={label} className={s.mini}>
                  {label}
                </span>
              ))}
            </span>
          </span>
        )}
      />
      {own !== null && (
        <div className={s.own}>
          <TextField
            label="Your cards"
            value={own}
            onChange={(text) => {
              setTooFew(false);
              setOwn(text);
            }}
            onSubmit={dealOwn}
            placeholder="1, 2, 4, 8 or small, big, huge"
            enterKeyHint="done"
            disabled={!!locked}
            error={tooFew ? TOO_FEW : undefined}
            hint={OWN_HINT}
            trailing={
              <Button onPress={dealOwn} disabled={!!locked}>
                Deal these
              </Button>
            }
          />
        </div>
      )}
      <Toggle
        label={`❓ Add a “${EXTRA_CARDS.unsure.name.toLowerCase()}” card`}
        checked={choice.unsure}
        onChange={(unsure) => deal({ ...choice, unsure })}
        disabled={!!locked}
      />
      <Toggle
        label="☕ Add a “break” card"
        checked={choice.coffee}
        onChange={(coffee) => deal({ ...choice, coffee })}
        disabled={!!locked}
      />
      <p className={s.note}>{locked ?? "Extra cards add nothing to the pot and can't win it."}</p>
      <Toggle
        label="🃏 I play a card too"
        checked={room.settings.dealerPlays}
        onChange={(on) => actions.dealer.setPlays(on)}
      />
      <Carousel
        label="🧳 The table is in"
        options={ENVIRONMENT_IDS}
        value={room.environment}
        onChange={(id) => actions.dealer.moveTo(id)}
        render={(id) => ENVIRONMENT[id].name}
      />
    </div>
  );
}
