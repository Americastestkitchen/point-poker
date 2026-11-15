// The dealer menu (popup "dealer"): everything the dealer runs, in three tabs.
// Round: the ticket on the table, then Restart vote, Skip ticket, Pick a ticket and Cancel round
// (asks first); each one closes the menu. Players: who's here and their state, Kick (asks
// first) and the invite link. House rules: the cards, who plays, the room (HouseRules.tsx).
// Opened from the top bar's 🎩 and the lobby dock's "House rules"; it opens on House rules in
// the lobby and on Round once the game is on. What shows is decided in panel.ts.
// Dealer only: it follows the role. Confirms are local dialogs inside this one, not popups.
import { useEffect, useRef, useState } from "react";
import { Button, ConfirmDialog, Dialog, MenuList, Tabs } from "../../ui/index.ts";
import { useGame, useMe, usePopup, useRoom } from "../game.tsx";
import { PlayerDot } from "../parts/PlayerDot.tsx";
import { HouseRules } from "./HouseRules.tsx";
import {
  CANCEL_CONFIRM,
  DEALER_TABS,
  kickConfirm,
  landingTab,
  othersOf,
  playerState,
  roundActions,
  roundCard,
  skipPlan,
  type DealerTab,
  type RoundActionId,
} from "./panel.ts";
import s from "./DealerMenu.module.css";

export function DealerMenu() {
  const { store } = useGame();
  const popup = usePopup("dealer");
  const isDealer = useMe()?.isDealer ?? false;
  // the role moved away while it was open: let it go, so Esc and the other popups work again
  useEffect(() => {
    if (popup.open && !isDealer) store.popupClosed("dealer");
  }, [store, popup.open, isDealer]);
  if (!isDealer) return null;
  return (
    <Dialog open={popup.open} onClose={popup.close} title="🎩 Dealer" width="sm">
      <MenuBody />
    </Dialog>
  );
}

/** Mounted only while the menu is open: it lands on the right tab, and a half-asked confirm is gone next time. */
function MenuBody() {
  const room = useRoom();
  const [tab, setTab] = useState<DealerTab>(() => (room ? landingTab(room) : "round"));
  if (!room) return null;
  return (
    <Tabs label="Dealer menu" tabs={DEALER_TABS} value={tab} onChange={setTab} className={s.tabs}>
      {tab === "round" && <RoundTab />}
      {tab === "players" && <PlayersTab />}
      {tab === "rules" && <HouseRules />}
    </Tabs>
  );
}

function RoundTab() {
  const { store, actions, ticketLoad } = useGame();
  const room = useRoom();
  const [cancelling, setCancelling] = useState(false);
  if (!room) return null;

  const card = roundCard(room);
  const all = roundActions(room);
  // only what can be done now: between rounds that's just picking a ticket
  const shown = all.filter((a) => a.enabled);
  const done = () => store.popupClosed("dealer");
  const press = (id: RoundActionId) => {
    switch (id) {
      case "restart":
        actions.dealer.deal();
        return done();
      case "skip": {
        const plan = skipPlan(room);
        if (plan.t === "load") ticketLoad.run(actions.dealer.wait.skip(), plan.text);
        else actions.dealer.skip();
        return done();
      }
      case "pick":
        // replaces this popup
        return store.popupOpened("picker");
      case "cancel":
        return setCancelling(true);
    }
  };

  return (
    <div className={s.stack}>
      <div className={s.card} data-empty={card.empty || undefined}>
        {card.key && <span className={s.key}>{card.key}</span>}
        <span className={s.title}>{card.title}</span>
        {card.line && <span className={s.line}>{card.line}</span>}
      </div>

      <div className={s.group}>
        <MenuList
          label="This round"
          items={shown.map((a) => ({
            id: a.id,
            label: a.danger ? <span className={s.danger}>{a.label}</span> : a.label,
            hint: a.sub,
          }))}
          onSelect={press}
        />
      </div>

      <ConfirmDialog
        open={cancelling}
        title={CANCEL_CONFIRM.title}
        confirmLabel={CANCEL_CONFIRM.confirm}
        tone="danger"
        onCancel={() => setCancelling(false)}
        onConfirm={() => {
          setCancelling(false);
          actions.dealer.cancel();
          done();
        }}
      >
        <p className={s.confirm}>{CANCEL_CONFIRM.body}</p>
      </ConfirmDialog>
    </div>
  );
}

function PlayersTab() {
  const { actions, invite } = useGame();
  const room = useRoom();
  const [kickId, setKickId] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const others = othersOf(room?.players ?? []);
  // a kicked player's row goes, and its Kick had the focus: keep the keyboard in the menu
  useEffect(() => {
    if (document.activeElement === document.body)
      box.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the count is the trigger: a row leaving can take the focus with it
  }, [others.length]);
  if (!room) return null;

  // derived, so a player who left meanwhile takes their question with them
  const kicking = others.find((p) => p.id === kickId);
  const kick = kicking && kickConfirm(kicking.name);

  return (
    <div ref={box} className={s.stack}>
      {others.length === 0 ? (
        <p className={s.empty}>Nobody else here yet. Send them the invite link!</p>
      ) : (
        <ul className={s.group}>
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
                  variant="link"
                  size="sm"
                  className={s.kick}
                  aria-label={`Kick ${p.name}`}
                  onPress={() => setKickId(p.id)}
                >
                  Kick
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button className={s.invite} onPress={invite}>
        🔗 Copy invite link
      </Button>

      <ConfirmDialog
        open={!!kick}
        title={<span className={s.wrap}>{kick?.title}</span>}
        confirmLabel={kick?.confirm ?? "Kick"}
        tone="danger"
        onCancel={() => setKickId(null)}
        onConfirm={() => {
          setKickId(null);
          if (kicking) actions.dealer.kick(kicking.id);
        }}
      >
        <p className={s.confirm}>{kick?.body}</p>
      </ConfirmDialog>
    </div>
  );
}
