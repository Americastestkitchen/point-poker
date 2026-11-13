// SLICE: chrome. The game menu (popup "menu"). Esc at the table already opens it: the screen
// root registers that (GameRoot.tsx useMenuKey), so this file only draws the menu and acts.
// Items (issue #11): Resume (close), Character (close, then useGame().openLook()), Options
// (popup "options"), How to play (popup "help"), Invite (useGame().invite()), Leave table
// (ConfirmDialog, then useGame().leaveTable()). Use the kit MenuList.
// Legacy parity: new in #11; it takes over the top-bar buttons that leave the top bar.
// Props: none (reads useGame() / useAppState()).
import { Dialog } from "../../ui/index.ts";
import { usePopup } from "../game.tsx";
import s from "./GameMenu.module.css";

export function GameMenu() {
  const popup = usePopup("menu");
  return (
    <Dialog open={popup.open} onClose={popup.close} title="Paused">
      <p className={s.placeholder}>GameMenu · chrome</p>
    </Dialog>
  );
}
