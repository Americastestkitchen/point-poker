import { useState, type ReactNode } from "react";
import { BODIES } from "../../../../shared/catalog/bodies.ts";
import { COLORS } from "../../../../shared/catalog/colors.ts";
import { COSMETICS } from "../../../../shared/catalog/cosmetics.ts";
import type { Audio } from "../../audio/sfx.ts";
import { useUi } from "../context.tsx";
import type { DemoState } from "../focus.ts";
import { Button, ButtonLink } from "../kit/Button.tsx";
import { Carousel } from "../kit/Carousel.tsx";
import { CodeSlots } from "../kit/CodeSlots.tsx";
import { CoinCounter } from "../kit/CoinCounter.tsx";
import { ConfirmDialog } from "../kit/ConfirmDialog.tsx";
import { Dialog } from "../kit/Dialog.tsx";
import { KeyHint } from "../kit/KeyHint.tsx";
import { MenuList } from "../kit/MenuList.tsx";
import { Panel } from "../kit/Panel.tsx";
import { ScrollArea } from "../kit/ScrollArea.tsx";
import { Slider } from "../kit/Slider.tsx";
import { Spinner } from "../kit/Spinner.tsx";
import { TextField } from "../kit/TextField.tsx";
import { Toast } from "../kit/Toast.tsx";
import { Toggle } from "../kit/Toggle.tsx";
import { Tooltip } from "../kit/Tooltip.tsx";
import { tokens, varName } from "../tokens.ts";
import s from "./Gallery.module.css";

type State = "normal" | DemoState | "disabled";
const STATES: readonly State[] = ["normal", "hover", "focus", "pressed", "disabled"];

/** One primitive, drawn once per state. */
function States({
  render,
  wide,
}: {
  render: (demo: DemoState | undefined, disabled: boolean) => ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`${s.states} ${wide ? s.wide : ""}`}>
      {STATES.map((st) => (
        <figure key={st} className={s.cell}>
          <div className={s.sample}>
            {render(st === "normal" || st === "disabled" ? undefined : st, st === "disabled")}
          </div>
          <figcaption>{st}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function Section({ name, note, children }: { name: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.section} id={name}>
      <h2 className={s.h2}>{name}</h2>
      {note && <p className={s.note}>{note}</p>}
      {children}
    </section>
  );
}

const MENU = [
  { id: "open", label: "Open a table", hint: "you'll be the dealer" },
  { id: "join", label: "Join a table" },
  { id: "character", label: "Character" },
  { id: "options", label: "Options" },
  { id: "help", label: "How to play", disabled: true },
] as const;
type MenuId = (typeof MENU)[number]["id"];

const swatch = (c: string) => <span className={s.swatch} style={{ background: c }} />;

export function Gallery({ audio }: { audio: Audio }) {
  const { toasts } = useUi();
  const [picked, setPicked] = useState<string>("nothing yet");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [body, setBody] = useState<(typeof BODIES)[number]>(BODIES[0]);
  const [hat, setHat] = useState<(typeof COSMETICS)[number]>(COSMETICS[1]);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [muted, setMuted] = useState(audio.muted);
  const [music, setMusic] = useState(true);
  const [volume, setVolume] = useState(0.6);
  const [coins, setCoins] = useState(1240);
  const [dialog, setDialog] = useState<"none" | "plain" | "stacked" | "must" | "paper" | "confirm">("none");
  const [field, setField] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [on, setOn] = useState(true);
  const submitField = (v: string) => {
    if (/^[A-Z]+-\d+$/i.test(v.trim())) {
      setFieldError("");
      toasts.show(`Dealing ${v.trim().toUpperCase()}`, { tone: "success" });
    } else setFieldError("Paste a Jira link, or a key like SD-1234");
  };
  const [mustOnTop, setMustOnTop] = useState(false);

  return (
    <main className={s.page}>
      <header className={s.header}>
        <h1 className={s.h1}>
          Point Poker <span>UI kit</span>
        </h1>
        <p className={s.note}>
          Every primitive in every state, then a playground. Arrow keys, Enter and Esc work everywhere; hovering with
          the mouse moves the same focus.
        </p>
        <div className={s.row}>
          <Toggle
            label="Sound"
            checked={!muted}
            onChange={(on) => {
              audio.setMuted(!on);
              setMuted(!on);
            }}
          />
          <KeyHint keys={["ArrowUp", "ArrowDown"]}>Move</KeyHint>
          <KeyHint keys={["Enter"]}>Pick</KeyHint>
          <KeyHint keys={["Escape"]}>Back</KeyHint>
        </div>
      </header>

      <Section name="Tokens" note="Defined once in ui/tokens.ts and declared as --pp-* CSS variables.">
        <div className={s.tokens}>
          {Object.keys(tokens.color).map((k) => (
            <div key={k} className={s.token}>
              {swatch(`var(${varName("color", k)})`)}
              <code>{k}</code>
            </div>
          ))}
        </div>
        <div className={s.row}>
          {(["display", "body", "card"] as const).map((f) => (
            <span key={f} className={s.font} style={{ fontFamily: `var(${varName("font", f)})` }}>
              {f}: Aa 1 2 3 5 8
            </span>
          ))}
        </div>
        <div className={s.row}>
          {Object.keys(tokens.glow).map((g) => (
            <span key={g} className={s.glow} style={{ boxShadow: `var(${varName("glow", g)})` }}>
              {g}
            </span>
          ))}
          {Object.keys(tokens.space).map((n) => (
            <span key={n} className={s.space} style={{ width: `var(${varName("space", n)})` }} title={`space ${n}`} />
          ))}
        </div>
      </Section>

      <Section name="Button">
        {(["default", "primary", "danger", "ghost"] as const).map((v) => (
          <States
            key={v}
            render={(demo, disabled) => (
              <Button
                variant={v}
                demoState={demo}
                disabled={disabled}
                sub={v === "primary" ? "you'll be the dealer" : undefined}
              >
                {v === "primary" ? "Open a table" : v}
              </Button>
            )}
          />
        ))}
        <States
          render={(demo, disabled) => (
            <Button variant="link" demoState={demo} disabled={disabled}>
              Vote again
            </Button>
          )}
        />
        <div className={s.row}>
          <Button size="sm">Small</Button>
          <Button>Medium</Button>
          <Button size="lg" variant="primary">
            Large
          </Button>
          <Button size="lg" variant="primary" sub="SD-124">
            Next ticket →
          </Button>
        </div>
        <p className={s.note}>
          Shapes for a bar of small controls: pills, and round icon buttons (give those an aria-label). aria-pressed
          lights one up.
        </p>
        <States
          render={(demo, disabled) => (
            <span className={s.row}>
              <Button shape="pill" size="sm" demoState={demo} disabled={disabled}>
                🔗 Invite
              </Button>
              <Button
                shape="round"
                size="md"
                aria-label="Sound"
                aria-pressed={on}
                demoState={demo}
                disabled={disabled}
                onPress={() => setOn(!on)}
              >
                {on ? "🔊" : "🔇"}
              </Button>
            </span>
          )}
        />
        <div className={s.row}>
          <Button shape="round" size="sm" aria-label="Help">
            ?
          </Button>
          <Button shape="round" aria-label="Menu">
            ☰
          </Button>
          <Button shape="round" size="lg" aria-label="Mic" aria-pressed>
            🎙️
          </Button>
          <Button shape="pill">🎩 Dealer</Button>
          <ButtonLink href="https://example.com" variant="link">
            Open in Jira ↗
          </ButtonLink>
          <ButtonLink href="https://example.com" size="sm">
            Open in Jira ↗
          </ButtonLink>
        </div>
      </Section>

      <Section
        name="TextField"
        note="Enter submits; a pasted key submits straight away. Try SD-1234, then something else."
      >
        <States
          wide
          render={(demo, disabled) => (
            <TextField
              label="Ticket"
              value={demo ? "SD-12" : ""}
              onChange={() => {}}
              placeholder="Paste a Jira link or key, like SD-1234"
              demoState={demo}
              disabled={disabled}
            />
          )}
        />
        <div className={s.grid3}>
          <TextField
            label="What are we estimating?"
            size="lg"
            hideLabel
            value={field}
            error={fieldError}
            placeholder="Paste a Jira link or key, like SD-1234"
            hint="Tip: paste an epic to line up all of its tickets."
            onChange={(v) => {
              setField(v);
              setFieldError("");
            }}
            onSubmit={submitField}
            onPasted={submitField}
            trailing={
              <Button size="sm" variant="primary" onPress={() => submitField(field)}>
                Deal it
              </Button>
            }
          />
          <TextField label="Your name" value="Ann" onChange={() => {}} error="That name's taken at this table" />
        </div>
      </Section>

      <Section
        name="ScrollArea"
        note="The kit's thin gold rail, not the browser's scrollbar. With a label it's a Tab stop the arrow keys scroll."
      >
        <div className={s.grid3}>
          <Panel padding="sm">
            <ScrollArea maxHeight="140px" label="Rounds played">
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className={s.note}>
                  SD-{120 + i} → {[1, 2, 3, 5, 8][i % 5]} pts
                </div>
              ))}
            </ScrollArea>
          </Panel>
        </div>
      </Section>

      <Section name="Spinner">
        <div className={s.row}>
          <Spinner size="sm" />
          <Spinner />
          <Spinner size="lg" />
          <Spinner label="Fetching SD-1234 from Jira…" />
        </div>
      </Section>

      <Section name="Panel">
        <div className={s.grid3}>
          <Panel title="Default">Dark plum glass with a thin gold edge.</Panel>
          <Panel title="Paper" variant="paper">
            Playing-card cream, for the ticket and cards.
          </Panel>
          <Panel title="Neon" variant="neon">
            The rare pink accent: title screen and logo only.
          </Panel>
        </div>
      </Section>

      <Section name="MenuList" note={`Picked: ${picked}`}>
        <States
          render={(demo, disabled) => (
            <MenuList
              label="Main menu"
              items={MENU.map((m) => ({ ...m, disabled: disabled || ("disabled" in m && m.disabled) }))}
              onSelect={(id: MenuId) => setPicked(id)}
              demo={demo ? { id: "open", state: demo } : undefined}
            />
          )}
        />
      </Section>

      <Section name="Carousel">
        <States
          render={(demo, disabled) => (
            <Carousel
              label="Hat"
              options={COSMETICS}
              value={hat}
              onChange={setHat}
              demoState={demo}
              disabled={disabled}
              render={(c) => (
                <span>
                  {c.icon} {c.label}
                </span>
              )}
            />
          )}
        />
        <div className={s.grid3}>
          <Carousel
            label="Body"
            options={BODIES}
            value={body}
            onChange={setBody}
            render={(b) => (
              <span>
                {b.icon} {b.label}
              </span>
            )}
          />
          <Carousel label="Colour" options={COLORS} value={color} onChange={setColor} render={(c) => swatch(c)} />
          <Carousel
            label="Hat"
            options={COSMETICS}
            value={hat}
            onChange={setHat}
            render={(c) => (
              <span>
                {c.icon} {c.label}
              </span>
            )}
          />
        </div>
      </Section>

      <Section name="CodeSlots" note="Type, paste or tap. A full code that isn't ABCD shakes.">
        <States
          wide
          render={(demo, disabled) => (
            <CodeSlots
              label="Table code"
              value={demo === "focus" ? "AB" : demo ? "ABCD" : ""}
              onChange={() => {}}
              demoState={demo}
              disabled={disabled}
            />
          )}
        />
        <div className={s.row}>
          <CodeSlots
            label="Try it"
            value={code}
            error={codeError}
            onChange={(c) => {
              setCode(c);
              setCodeError(false);
            }}
            onComplete={(c) => {
              if (c === "ABCD") toasts.show(`Joining table ${c}`, { tone: "success" });
              else {
                setCodeError(true);
                toasts.show(`No table ${c}`, { tone: "error" });
              }
            }}
          />
          <CodeSlots label="Error" value="ZZZZ" error onChange={() => {}} />
        </div>
      </Section>

      <Section name="Toggle">
        <States
          render={(demo, disabled) => (
            <Toggle label="Music" checked={music} onChange={setMusic} demoState={demo} disabled={disabled} />
          )}
        />
        <States
          render={(demo, disabled) => (
            <Toggle
              label="Music"
              checked={!music}
              onChange={(v) => setMusic(!v)}
              demoState={demo}
              disabled={disabled}
            />
          )}
        />
      </Section>

      <Section name="Slider">
        <States
          render={(demo, disabled) => (
            <Slider
              label="Volume"
              value={volume}
              onChange={setVolume}
              format={(v) => `${Math.round(v * 100)}%`}
              demoState={demo}
              disabled={disabled}
            />
          )}
        />
      </Section>

      <Section name="Dialog">
        <div className={s.row}>
          <Button onPress={() => setDialog("plain")}>Open a dialog</Button>
          <Button onPress={() => setDialog("stacked")}>Open one on top of another</Button>
          <Button onPress={() => setDialog("must")}>Open one you must answer</Button>
          <Button onPress={() => setDialog("paper")}>Open a long paper one</Button>
          <Button onPress={() => setDialog("confirm")}>Ask "are you sure?"</Button>
        </div>
        <Dialog
          open={dialog === "paper"}
          onClose={() => setDialog("none")}
          title="SD-1234 · Make the export faster"
          variant="paper"
          width="xl"
        >
          {Array.from({ length: 30 }, (_, i) => (
            <p key={i}>Line {i + 1}: only this body scrolls; the title stays put on a short phone.</p>
          ))}
        </Dialog>
        <ConfirmDialog
          open={dialog === "confirm"}
          title="Kick Ann?"
          tone="danger"
          confirmLabel="Kick"
          onConfirm={() => {
            setDialog("none");
            toasts.show("Ann was kicked", { tone: "error" });
          }}
          onCancel={() => setDialog("none")}
        >
          <p>They won't be able to rejoin this table.</p>
        </ConfirmDialog>
        <Dialog
          open={dialog === "plain" || dialog === "stacked"}
          onClose={() => setDialog("none")}
          title="Leave the table?"
          actions={
            <>
              <Button onPress={() => setDialog("none")}>Stay</Button>
              <Button variant="danger" onPress={() => setDialog("none")}>
                Leave
              </Button>
            </>
          }
        >
          <p>Your seat stays warm for a minute in case you come back.</p>
          {dialog === "stacked" && <StackedDialog />}
          {dialog === "plain" && (
            <Button size="sm" variant="ghost" onPress={() => setMustOnTop(true)}>
              Put a must-answer one on top
            </Button>
          )}
        </Dialog>
        {/* a sibling, not a child: it opens later, over the dialog above */}
        <Dialog
          open={mustOnTop}
          onClose={() => setMustOnTop(false)}
          title="Still there?"
          dismissable={false}
          width="sm"
          actions={
            <Button variant="primary" onPress={() => setMustOnTop(false)}>
              I'm here
            </Button>
          }
        >
          <p>Esc does nothing here, and doesn't close the dialog underneath either.</p>
        </Dialog>
        <Dialog
          open={dialog === "must"}
          onClose={() => setDialog("none")}
          title="The dealer left"
          dismissable={false}
          width="sm"
          actions={
            <Button variant="primary" onPress={() => setDialog("none")}>
              Take over as dealer
            </Button>
          }
        >
          <p>Someone has to run the table. No Esc out of this one.</p>
        </Dialog>
      </Section>

      <Section name="Toast">
        <div className={s.row}>
          <Toast>SD-123 was updated</Toast>
          <Toast tone="success">Everyone's in</Toast>
          <Toast tone="error">Couldn't reach Jira</Toast>
        </div>
        <div className={s.row}>
          <Button size="sm" onPress={() => toasts.show("SD-123 was updated")}>
            Info toast
          </Button>
          <Button size="sm" onPress={() => toasts.show("Everyone's in", { tone: "success" })}>
            Success toast
          </Button>
          <Button size="sm" onPress={() => toasts.show("Couldn't reach Jira", { tone: "error" })}>
            Error toast
          </Button>
        </div>
      </Section>

      <Section name="Tooltip">
        <div className={`${s.row} ${s.roomy}`}>
          <Tooltip text="Copies the invite link">
            <Button>Hover or focus me</Button>
          </Tooltip>
          <Tooltip text="Always shown (gallery)" open>
            <Button>Shown</Button>
          </Tooltip>
          <Tooltip text="Below" side="bottom" open>
            <Button>Below</Button>
          </Tooltip>
        </div>
      </Section>

      <Section name="KeyHint" note="Hidden on touch-only screens.">
        <div className={s.row}>
          <KeyHint keys={["Escape"]}>Back</KeyHint>
          <KeyHint keys={["Enter"]}>Pick</KeyHint>
          <KeyHint keys={["ArrowLeft", "ArrowRight"]}>Change</KeyHint>
          <KeyHint keys={["r"]}>Recenter</KeyHint>
        </div>
      </Section>

      <Section name="CoinCounter">
        <div className={s.row}>
          <CoinCounter value={coins} />
          <CoinCounter value={coins} size="lg" />
          <Button size="sm" onPress={() => setCoins((c) => c + 150)}>
            Win 150
          </Button>
          <Button size="sm" onPress={() => setCoins((c) => Math.max(0, c - 40))}>
            Pay 40
          </Button>
        </div>
      </Section>
    </main>
  );
}

function StackedDialog() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="On top"
      width="sm"
      actions={<Button onPress={() => setOpen(false)}>Close</Button>}
    >
      <p>Esc closes only this one first.</p>
    </Dialog>
  );
}
