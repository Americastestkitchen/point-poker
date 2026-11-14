// How to play (popup "help"), opened from the game menu.
// The four steps, then "Just for fun": drag to look
// around, pick a hand item and click someone to use it on them, Z X C V to wave / laugh / think /
// gasp, E for the wheel of emotes, click the duck. Also R to recenter the view (scene/engine/input.ts).
// Closing it (Esc, ✕, Back) goes back to the menu when it was opened from there.
import { EMOTE_WHEEL_KEY, EMOTES } from "../../../../shared/catalog/emotes.ts";
import { ITEMS } from "../../../../shared/catalog/items.ts";
import { Button, Dialog, KeyHint } from "../../ui/index.ts";
import { usePopupWithBack } from "./popups.ts";
import s from "./HowToPlayDialog.module.css";

const STEPS = [
  "The dealer puts a Jira ticket on the table.",
  "Everyone picks a card for how big they think it is. Nobody sees yours yet.",
  "The dealer flips the cards. Talked round? Swap your card while everyone argues, then the dealer picks the final points.",
  "Closest guess wins the pot (just for fun), but only if it's within one card of the final call. Ties split it.",
] as const;

/** The emotes with a key of their own, and what each does, in the help's words. */
const KEYED = EMOTES.flatMap((e) => (e.key === null ? [] : [{ key: e.key, word: e.name.toLowerCase() }]));

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
            🔨
          </span>
          Click or tap someone to use your hand item on them
        </li>
        <li className={s.keys}>
          <KeyHint keys={ITEMS.map((i) => i.key)} />
          <span>or the scroll wheel to pick one: {ITEMS.map((i) => i.emoji).join(" ")}</span>
        </li>
        <li>
          <span className={s.icon} aria-hidden>
            🦆
          </span>
          Click the duck
        </li>
        <li className={s.keys}>
          <KeyHint keys={KEYED.map((e) => e.key)} />
          <span>{KEYED.map((e) => e.word).join(", ")}</span>
        </li>
        <li className={s.keys}>
          <KeyHint keys={[EMOTE_WHEEL_KEY]} />
          <span>or 😀 for the rest. Open it just after someone emotes to answer them</span>
        </li>
        <li className={s.keys}>
          <KeyHint keys={["r"]} />
          <span>to look back at the table</span>
        </li>
      </ul>
    </Dialog>
  );
}
