// Character select: your bean on its turntable on one side, the body, colour, hat and
// face (eyewear, nose, facial hair) carousels, a name and a randomize button on the other. The title screens use it before you
// sit down, and at the table "Change look" opens it over the room (without the name, which
// the table already knows you by). The draft is local until Done; at the table `onChange` sends
// each change of look as it's made, so everyone watches you try things on.
import { useState } from "react";
import { BODIES, BODY_IDS } from "../../../../shared/catalog/bodies.ts";
import { COLOR_NAMES, COLORS } from "../../../../shared/catalog/colors.ts";
import { COSMETICS, fitting, type CosmeticId, type Slot } from "../../../../shared/catalog/cosmetics.ts";
import { byId } from "../../../../shared/catalog/registry.ts";
import { randomLook, wornIn } from "../../../../shared/look.ts";
import { editProfile, readyToSit, type ProfileAction } from "../../app/profile.ts";
import type { Profile } from "../../app/storage.ts";
import { Button, Carousel, Panel, TextField, useBack } from "../../ui/index.ts";
import { useShowcase } from "./showcase.ts";
import s from "./CharacterEditor.module.css";

const BODY = byId(BODIES);
const COSMETIC = byId(COSMETICS);
/** A carousel per slot: nothing first, then everything that fits there. */
const WARDROBE = (
  [
    { slot: "head", label: "Hat", none: "no hat" },
    { slot: "eyes", label: "Eyewear", none: "no glasses" },
    { slot: "nose", label: "Nose", none: "just your own" },
    { slot: "facialHair", label: "Facial hair", none: "clean shaven" },
  ] as const satisfies readonly { slot: Slot; label: string; none: string }[]
).map((w) => ({ ...w, options: [null, ...fitting(w.slot).map((c) => c.id)] satisfies (CosmeticId | null)[] }));

export interface CharacterEditorProps {
  initial: Profile;
  /** Before you sit down you pick a name too; at the table it's already set. */
  withName: boolean;
  /** You deal this table: the bean wears the dealer's gear. */
  dealer: boolean;
  /** The primary button's words: "Done", "Open the table", "Join table ABCD". */
  doneLabel: string;
  /** Your look changed (not your name): what it is now. */
  onChange?(look: Profile["look"]): void;
  onDone(profile: Profile): void;
  onBack(): void;
}

export function CharacterEditor({
  initial,
  withName,
  dealer,
  doneLabel,
  onChange,
  onDone,
  onBack,
}: CharacterEditorProps) {
  const [draft, setDraft] = useState(initial);
  const [nameError, setNameError] = useState(false);
  const stage = useShowcase(draft.look, dealer);
  /** The draft becomes `next`; a new look is told to whoever's listening. */
  const change = (next: Profile) => {
    setDraft(next);
    if (next.look !== draft.look) onChange?.(next.look);
  };
  const edit = (a: ProfileAction) => change(editProfile(draft, a));
  const randomize = () => change({ ...draft, look: randomLook() });
  useBack(onBack, true, 1);

  const done = () => {
    const ready = withName ? readyToSit(draft) : draft;
    if (!ready) return setNameError(true);
    onDone(ready);
  };
  return (
    <section className={s.screen} aria-label="Character">
      <h1 className={s.title}>Character</h1>
      <div ref={stage} className={s.stage} aria-hidden />
      <Panel className={s.panel} title={withName ? "Your bean" : "Change your look"}>
        <div className={s.fields}>
          {withName && (
            <TextField
              label="Name"
              value={draft.name}
              onChange={(name) => {
                setNameError(false);
                edit({ t: "name", name });
              }}
              onSubmit={done}
              placeholder="What should we call you?"
              error={nameError ? "Give your bean a name first." : undefined}
              maxLength={18}
              autoFocus={!draft.name}
              enterKeyHint="done"
            />
          )}
          <Carousel
            label="Body"
            options={BODY_IDS}
            value={draft.look.body}
            onChange={(body) => edit({ t: "body", body })}
            render={(b) => BODY[b].label}
          />
          <Carousel
            label="Colour"
            options={COLORS}
            value={draft.look.color}
            onChange={(color) => edit({ t: "color", color })}
            render={(c) => (
              <span className={s.colour}>
                <span className={s.swatch} style={{ background: c }} />
                {COLOR_NAMES[c]}
              </span>
            )}
          />
          {WARDROBE.map(({ slot, label, none, options }) => (
            <Carousel
              key={slot}
              label={label}
              options={options}
              value={wornIn(draft.look, slot)}
              onChange={(id) => edit({ t: "wear", slot, id })}
              render={(id) => (id ? COSMETIC[id].label : none)}
            />
          ))}
          <Button shape="pill" onPress={randomize}>
            🎲 Randomize
          </Button>
        </div>
      </Panel>
      <footer className={s.actions}>
        <Button variant="ghost" onPress={onBack}>
          Back
        </Button>
        <Button variant="primary" size="lg" onPress={done}>
          {doneLabel}
        </Button>
      </footer>
    </section>
  );
}
