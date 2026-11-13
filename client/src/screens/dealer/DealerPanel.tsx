// The dealer's control panel (popup "dealer"), opened from the top bar.
// "This round": Restart vote, Skip ticket, Cancel round (asks first), Pick a ticket; each one
// closes the panel. The players with their state and a Kick (asks first), and "I play a card
// too". What shows and what's enabled is decided in panel.ts. Dealer only: it follows the role.
// Confirms are local dialogs inside this one, not popups.
import { useEffect, useRef, useState } from "react";
import { Button, ConfirmDialog, Dialog, ScrollArea, Toggle } from "../../ui/index.ts";
import { useGame, useMe, usePopup, useRoom } from "../game.tsx";
import { PlayerDot } from "../parts/PlayerDot.tsx";
import {
  CANCEL_CONFIRM,
  kickConfirm,
  othersOf,
  playerState,
  roundActions,
  skipPlan,
  type RoundActionId,
} from "./panel.ts";
import { Section } from "./Section.tsx";
import s from "./DealerPanel.module.css";

export function DealerPanel() {
  const { store } = useGame();
  const popup = usePopup("dealer");
  const isDealer = useMe()?.isDealer ?? false;
  // the role moved away while it was open: let it go, so Esc and the other popups work again
  useEffect(() => {
    if (popup.open && !isDealer) store.popupClosed("dealer");
  }, [store, popup.open, isDealer]);
  if (!isDealer) return null;
  return (
    <Dialog open={popup.open} onClose={popup.close} title="🎩 Dealer controls">
      <PanelBody />
    </Dialog>
  );
}

type Confirm = { t: "cancel" } | { t: "kick"; id: string };

/** Mounted only while the panel is open, so a half-asked confirm is gone next time. */
function PanelBody() {
  const { store, actions, dealerDo, ticketLoad } = useGame();
  const room = useRoom();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const others = othersOf(room?.players ?? []);
  // a kicked player's row goes, and its Kick had the focus: keep the keyboard in the panel
  useEffect(() => {
    if (document.activeElement === document.body)
      box.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [others.length]);
  if (!room) return null;

  const done = () => store.popupClosed("dealer");
  const press = (id: RoundActionId) => {
    switch (id) {
      case "restart":
        dealerDo(actions.dealer.deal());
        return done();
      case "skip": {
        const plan = skipPlan(room);
        if (plan.t === "load") ticketLoad.run(actions.dealer.skip(), plan.text);
        else dealerDo(actions.dealer.skip());
        return done();
      }
      case "cancel":
        return setConfirm({ t: "cancel" });
      case "pick":
        // replaces this popup
        return store.popupOpened("picker");
    }
  };

  // derived, so a player who left meanwhile takes their question with them
  const kicking = confirm?.t === "kick" ? others.find((p) => p.id === confirm.id) : undefined;
  const kick = kicking && kickConfirm(kicking.name);

  return (
    <div ref={box} className={s.body}>
      <Section title="This round">
        <div className={s.actions}>
          {roundActions(room).map((a) => (
            <Button
              key={a.id}
              variant={a.danger ? "danger" : "default"}
              disabled={!a.enabled}
              sub={a.sub}
              className={s.action}
              onPress={() => press(a.id)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title={`Players (${others.length})`}>
        {others.length === 0 ? (
          <p className={s.empty}>Nobody else here yet. Send the invite link.</p>
        ) : (
          <ScrollArea className={s.players}>
            <ul className={s.list}>
              {others.map((p) => {
                const state = playerState(p, room.phase);
                return (
                  <li key={p.id} className={s.player} data-away={!p.connected || undefined}>
                    <PlayerDot player={p} filled={p.connected} />
                    <span className={s.name} title={p.name}>
                      {p.name}
                    </span>
                    {state && (
                      <span className={s.state} data-voted={(p.hasVoted && p.connected) || undefined}>
                        {state}
                      </span>
                    )}
                    <Button
                      variant="danger"
                      shape="pill"
                      size="md"
                      className={s.kick}
                      aria-label={`Kick ${p.name}`}
                      onPress={() => setConfirm({ t: "kick", id: p.id })}
                    >
                      Kick
                    </Button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </Section>

      <Toggle
        label="🃏 I play a card too"
        checked={room.settings.dealerPlays}
        onChange={(on) => dealerDo(actions.dealer.setPlays(on))}
      />

      <ConfirmDialog
        open={confirm?.t === "cancel"}
        title={CANCEL_CONFIRM.title}
        confirmLabel={CANCEL_CONFIRM.confirm}
        tone="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          dealerDo(actions.dealer.cancel());
          done();
        }}
      >
        <p className={s.confirm}>{CANCEL_CONFIRM.body}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!kick}
        title={<span className={s.wrap}>{kick?.title}</span>}
        confirmLabel={kick?.confirm ?? "Kick"}
        tone="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          if (kicking) dealerDo(actions.dealer.kick(kicking.id));
        }}
      >
        <p className={s.confirm}>{kick?.body}</p>
      </ConfirmDialog>
    </div>
  );
}
