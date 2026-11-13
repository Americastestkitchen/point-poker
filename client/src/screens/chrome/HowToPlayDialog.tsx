// How to play (popup "help"), opened from the game menu.
// The four steps, then "Just for fun": drag to look
// around, click someone to flick a chip, Z X C V to wave / laugh / think / gasp, click the
// duck. Also R / a double-click to recenter the view (scene/engine/input.ts).
// Closing it (Esc, ✕, Back) goes back to the menu when it was opened from there.
import { EMOTES } from "../../../../shared/catalog/emotes.ts";
import { Button, Dialog, KeyHint } from "../../ui/index.ts";
import { usePopupWithBack } from "./popups.ts";
import s from "./HowToPlayDialog.module.css";

const STEPS = [
  "The dealer puts a Jira ticket on the table.",
  "Everyone picks a card for how big they think it is. Nobody sees yours yet.",
  "The dealer flips the cards and picks the final points.",
  "Closest guess wins the pot (just for fun), but only if it's within one card of the final call. Ties split it.",
] as const;

/** What each emote's key does, in the help's words. */
const EMOTE_WORDS: Record<(typeof EMOTES)[number]["id"], string> = {
  wave: "wave",
  laugh: "laugh",
  think: "think",
  shock: "gasp",
};

export function HowToPlayDialog() {
  const popup = usePopupWithBack("help");
  return (
    <Dialog
      open={popup.open}
      onClose={popup.close}
      title="How it works"
      width="md"
      actions={
        <Button variant="primary" onPress={popup.close}>
          {popup.back ? "◂ Back" : "Got it"}
        </Button>
      }
    >
      <ol className={s.steps}>
        {STEPS.map((step, i) => (
          <li key={step} className={s.step}>
            <span className={s.num} aria-hidden>
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <h3 className={s.heading}>Just for fun</h3>
      <ul className={s.fun}>
        <li>
          <span className={s.icon} aria-hidden>
            👀
          </span>
          Drag the room to look around
        </li>
        <li>
          <span className={s.icon} aria-hidden>
            🪙
          </span>
          Click or tap someone to flick a chip at them
        </li>
        <li>
          <span className={s.icon} aria-hidden>
            🦆
          </span>
          Click the duck
        </li>
        <li className={s.keys}>
          <KeyHint keys={EMOTES.map((e) => e.key)} />
          <span>{EMOTES.map((e) => EMOTE_WORDS[e.id]).join(", ")}</span>
        </li>
        <li className={s.keys}>
          <KeyHint keys={["r"]} />
          <span>or double-click the room to look back at the table</span>
        </li>
      </ul>
    </Dialog>
  );
}
