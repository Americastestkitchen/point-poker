// SLICE: chrome. Options (popup "options"), opened from the game menu.
// Legacy parity: the sound button (#mute: audio.muted / audio.setMuted(), kit Toggle) and the
// mic (#mic, through useGame().mic and useMicStatus()), plus anything that is a setting
// rather than something you need at a glance.
// Props: none.
import { Dialog } from "../../ui/index.ts";
import { usePopup } from "../game.tsx";
import s from "./OptionsDialog.module.css";

export function OptionsDialog() {
  const popup = usePopup("options");
  return (
    <Dialog open={popup.open} onClose={popup.close} title="Options">
      <p className={s.placeholder}>OptionsDialog · chrome</p>
    </Dialog>
  );
}
