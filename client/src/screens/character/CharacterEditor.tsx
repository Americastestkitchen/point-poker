// Character select: your bean on its turntable on one side, the body, colour and hat
// carousels, a name and a randomize button on the other. The title screens use it before you
// sit down, and the game menu's "Change look" opens it over the table (without the name, which
// the table already knows you by). The draft is local until Done.
import { useState } from "react";
import { BODIES } from "../../../../shared/catalog/bodies.ts";
import { COLOR_NAMES, COLORS } from "../../../../shared/catalog/colors.ts";
import { COSMETICS, type CosmeticId } from "../../../../shared/catalog/cosmetics.ts";
import { randomLook, wornIn } from "../../../../shared/look.ts";
import { editProfile, readyToSit, type ProfileAction } from "../../app/profile.ts";
import type { Profile } from "../../app/storage.ts";
import { Button, Carousel, Panel, TextField, useBack } from "../../ui/index.ts";
import { useShowcase } from "./showcase.ts";
import s from "./CharacterEditor.module.css";

const BODY_IDS = BODIES.map((b) => b.id);
const BODY_LABEL = new Map(BODIES.map((b) => [b.id, b.label]));
/** Bare, then everything that sits on your head. */
const HATS: readonly (CosmeticId | null)[] = [
  null,
  ...COSMETICS.filter((c) => c.slots.includes("head")).map((c) => c.id),
];
const HAT_LABEL = new Map<CosmeticId | null, string>([
  [null, "no hat"],
  ...COSMETICS.map((c) => [c.id, c.label] as const),
]);

export interface CharacterEditorProps {
  initial: Profile;
  /** Before you sit down you pick a name too; at the table it's already set. */
  withName: boolean;
  /** You deal this table: the bean wears the dealer's gear. */
  dealer: boolean;
  /** The primary button's words: "Done", "Open the table", "Join table ABCD". */
  doneLabel: string;
  onDone(profile: Profile): void;
  onBack(): void;
}

export function CharacterEditor({ initial, withName, dealer, doneLabel, onDone, onBack }: CharacterEditorProps) {
  const [draft, setDraft] = useState(initial);
  const [nameError, setNameError] = useState(false);
  const stage = useShowcase(draft.look, dealer);
  const edit = (a: ProfileAction) => setDraft((p) => editProfile(p, a));
  const randomize = () => setDraft((p) => ({ ...p, look: randomLook() }));
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
            render={(b) => BODY_LABEL.get(b) ?? b}
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
          <Carousel
            label="Hat"
            options={HATS}
            value={wornIn(draft.look, "head")}
            onChange={(id) => edit({ t: "wear", slot: "head", id })}
            render={(h) => HAT_LABEL.get(h) ?? "no hat"}
          />
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
