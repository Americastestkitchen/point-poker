// SLICE: chrome. How to play (popup "help").
// Legacy parity: index.html #help-pop: the four steps, then "Just for fun": drag to look
// around, click someone to flick a chip, Z X C V to wave / laugh / think / gasp (KeyHint, keys
// from shared/catalog/emotes.ts EMOTES), click the duck.
// Props: none.
import { Dialog } from "../../ui/index.ts";
import { usePopup } from "../game.tsx";
import s from "./HowToPlayDialog.module.css";

export function HowToPlayDialog() {
  const popup = usePopup("help");
  return (
    <Dialog open={popup.open} onClose={popup.close} title="How it works">
      <p className={s.placeholder}>HowToPlayDialog · chrome</p>
    </Dialog>
  );
}
