// Options (popup "options"), opened from the game menu: things you set rather
// than need at a glance. Sound (audio.muted / audio.setMuted()) and the mic
// (the same control as the top bar's: useGame().mic and useMicStatus()).
// Closing it (Esc, ✕, Back) goes back to the menu when it was opened from there.
import { useReducer } from "react";
import { Button, Dialog, Toggle } from "../../ui/index.ts";
import { useGame, useMicStatus } from "../game.tsx";
import { micPressed } from "./model.ts";
import { usePopupWithBack } from "./popups.ts";
import s from "./OptionsDialog.module.css";

export function OptionsDialog() {
  const { audio, mic } = useGame();
  const popup = usePopupWithBack("options");
  const micStatus = useMicStatus();
  // audio.muted isn't a store: read it each render, and re-render when we flip it
  const [, flipped] = useReducer((n: number) => n + 1, 0);
  const soundOn = !audio.muted;

  return (
    <Dialog open={popup.open} onClose={popup.close} title="Options" width="sm"
      actions={<Button variant="primary" onPress={popup.close}>{popup.back ? "◂ Back" : "Done"}</Button>}>
      <div className={s.list}>
        <div className={s.option}>
          <Toggle label={soundOn ? "🔊 Sound" : "🔇 Sound"} checked={soundOn} onChange={(on) => { audio.setMuted(!on); flipped(); }} />
          <p className={s.note}>Card flips, chips and the basement's hum.</p>
        </div>
        <div className={s.option}>
          <Toggle label="🎙️ Mic" checked={micPressed(micStatus)} onChange={mic.toggle} />
          <p className={s.note}>
            {micStatus === "denied"
              ? "Your browser said no. Allow the mic for this site, then try again."
              : "Your character's mouth moves when you talk. Only how loud you are is used: no audio is sent."}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
