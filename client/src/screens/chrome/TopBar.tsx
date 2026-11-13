// The always-visible top bar: only what you need at a glance, right to left from
// the corner: the menu (☰, Esc), the mic, your coins (the leaderboard) and, for the dealer, the
// dealer's controls. A line about the connection shows up beside them while it's down.
// Invite, Character, Sound and Help live in the game menu.
import { useRef, type PointerEvent } from "react";
import { Button, CoinCounter, cx, KeyHint, Spinner, Tooltip } from "../../ui/index.ts";
import { useAppState, useGame, useMe, useMicStatus, usePopup } from "../game.tsx";
import { connectionLabel, micPressed, micTip } from "./model.ts";
import { useWallet } from "./wallet.ts";
import s from "./TopBar.module.css";

export function TopBar() {
  const me = useMe();
  const menu = usePopup("menu");
  const dealer = usePopup("dealer");
  const board = usePopup("leaderboard");
  const wallet = useRef<HTMLButtonElement>(null);
  const coins = useWallet(wallet, s.flyCoin ?? "pp-fly-coin");
  const iAmDealer = me?.isDealer ?? false;
  const tap = useLetGoAfterTouch();

  return (
    <nav className={s.bar} aria-label="Table">
      <div className={s.row}>
        <ConnectionLine />
        {iAmDealer && (
          // its tip opens to the right: it's the leftmost button, and on a phone that's mid-screen
          <span className={s.tipStart}>
            <Tooltip text="Dealer controls: skip, cancel, kick" side="bottom">
              <Button shape="pill" size="md" className={s.dealer} aria-label="Dealer controls" {...tap(dealer.show)}>
                <span aria-hidden>🎩</span>
                <span className={s.wide} aria-hidden>
                  Dealer
                </span>
              </Button>
            </Tooltip>
          </span>
        )}
        {coins !== null && (
          <Tooltip text="Leaderboard" side="bottom">
            <Button
              ref={wallet}
              shape="pill"
              size="md"
              className={s.wallet}
              aria-label={`${coins} coins: open the leaderboard`}
              {...tap(board.show)}
            >
              <CoinCounter value={coins} />
            </Button>
          </Tooltip>
        )}
        <MicButton />
        <Button
          shape="pill"
          size="md"
          className={s.menu}
          aria-label="Menu"
          aria-keyshortcuts="Escape"
          {...tap(menu.show)}
        >
          <span aria-hidden className={s.burger}>
            ☰
          </span>
          <span className={s.wide} aria-hidden>
            Menu
          </span>
          <span className={cx(s.wide, s.keycap)} aria-hidden>
            <KeyHint keys={["Escape"]} />
          </span>
        </Button>
      </div>
    </nav>
  );
}

/**
 * A tap shouldn't leave a chip focused: its tooltip would stay up over the HUD, and a popup it
 * opens would hand focus back to it. So after a touch (or pen) press the chip lets go of focus;
 * the mouse and the keyboard keep the kit's focus model. It lets go after the press, not on
 * pointerup: a tap focuses the button with the mouse events the browser makes up after it.
 */
function useLetGoAfterTouch() {
  const touched = useRef(false);
  return (action: () => void) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      touched.current = e.pointerType !== "mouse";
    },
    onPress() {
      action();
      if (!touched.current) return;
      touched.current = false;
      const el = document.activeElement;
      if (el instanceof HTMLElement) el.blur();
    },
  });
}

/** On/off for the mic. Your voice's loudness glows around it (written straight to the element). */
function MicButton() {
  const { mic } = useGame();
  const status = useMicStatus();
  const on = micPressed(status);
  const tap = useLetGoAfterTouch();
  return (
    <Tooltip text={micTip(status)} side="bottom">
      <Button
        ref={mic.meter}
        shape="round"
        size="md"
        className={cx(s.mic, status === "on" && s.live, status === "starting" && s.asking)}
        aria-label="Mic"
        aria-pressed={on}
        {...tap(mic.toggle)}
      >
        <span className={s.micIcon} aria-hidden>
          🎙️
        </span>
      </Button>
    </Tooltip>
  );
}

/** "reconnecting…" or "disconnected: why", only while the line to the table is down. */
function ConnectionLine() {
  const connection = useAppState((st) => st.connection);
  const label = connectionLabel(connection);
  if (!label) return null;
  const down = connection.status === "closed";
  return (
    <span className={cx(s.conn, down && s.down)} role="status" title={label}>
      <span aria-hidden className={s.connIcon}>
        {down ? "⚠" : <Spinner size="sm" />}
      </span>
      <span className={s.connText}>{label}</span>
    </span>
  );
}
