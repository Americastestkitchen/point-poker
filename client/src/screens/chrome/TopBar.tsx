// SLICE: chrome. The always-visible top bar: only what you need at a glance.
// Parity with legacy hud.ts: setupChrome() (#topbar: dealer button → popup "dealer" for the
// dealer only, coins → popup "leaderboard", invite → useGame().invite(), look → openLook(),
// mic → useGame().mic (toggle, useMicStatus(), ref={mic.meter} for the --mic-level glow), sound
// → audio.muted/setMuted, help → popup "help", #conn connection status from store.connection),
// setWallet/countWalletTo/coinBurst (CoinCounter; coins fly in after a win: listen with
// useViewChanges for "settled", and your own share is room.winners/share; fly over
// --pp-layer-burst). Things moved into the game menu (Esc) need not stay here (issue #11).
// Props: none, it reads useGame()/useAppState().
import { Button } from "../../ui/index.ts";
import { usePopup } from "../game.tsx";
import s from "./TopBar.module.css";

export function TopBar() {
  const menu = usePopup("menu");
  return (
    <nav className={s.bar} aria-label="Table">
      <span className={s.placeholder}>TopBar · chrome</span>
      <Button shape="round" size="md" aria-label="Menu" onPress={menu.show}>☰</Button>
    </nav>
  );
}
