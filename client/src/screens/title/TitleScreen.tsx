// The title screens, over the drifting 3D room: the main menu with your bean, joining by code,
// opening a table, character select, an invite link's "Join table ABCD", and an invite to a
// table that's gone. flow.ts decides where each choice leads; this draws the view and runs the
// effects it asks for (asking the server, sitting down) through the injected `title`.
import { useEffect, useRef, useState } from "react";
import { randomLook } from "../../../../shared/look.ts";
import { TABLE_CODE } from "../../../../shared/rules.ts";
import type { Profile, Storage } from "../../app/storage.ts";
import { Button, CodeSlots, Dialog, MenuList, Panel, Spinner, TextField, useBack } from "../../ui/index.ts";
import { CharacterEditor } from "../character/CharacterEditor.tsx";
import { useShowcase } from "../character/showcase.ts";
import { useGame } from "../game.tsx";
import { start, step, type Step, type TitleEffect, type TitleEvent, type TitleState, type TitleView } from "./flow.ts";
import logo from "../../../../assets/logo.svg";
import s from "./TitleScreen.module.css";

/** Your saved profile, or a fresh random bean to start from (saved: false). */
function loadProfile(storage: Storage): { profile: Profile; saved: boolean } {
  const p = storage.profile();
  const name = p.name?.trim() ?? "";
  return { profile: { name, look: p.look ?? randomLook() }, saved: !!name && !!p.look };
}

const MENU = [
  { id: "open", label: "Open a table", hint: "You deal: put tickets on the felt" },
  { id: "join", label: "Join a table", hint: "Got a 4-letter code?" },
  { id: "character", label: "Character" },
  { id: "options", label: "Options", hint: "Sound and mic" },
  { id: "help", label: "How to play" },
] as const;
type MenuId = (typeof MENU)[number]["id"];

/**
 * flow.ts's state and a dispatch that runs its effects. The current state also lives in a ref,
 * so an answer that arrives later steps from where you are by then, not from where you asked;
 * effects run here, in event handlers, never inside a state update React may repeat.
 */
function useTitleFlow(saved: boolean) {
  const { store, title } = useGame();
  const [first] = useState(() => start(title.inviteCode, saved));
  const [state, setState] = useState<TitleState>(first.state);
  const current = useRef(first.state);

  const dispatch = (e: TitleEvent) => apply(step(current.current, e));
  function apply({ state: next, effects }: Step) {
    current.current = next;
    setState(next);
    for (const effect of effects) run(effect);
  }
  function run(effect: TitleEffect) {
    switch (effect.t) {
      case "check":
        // the same question for an invite link and a typed code: the flow takes the one it asked
        return void title.tables.check(effect.code).then((r) => {
          const open = r.t !== "gone"; // if the server can't say, try the table anyway
          dispatch({ t: "checked", code: effect.code, open });
          dispatch({ t: "codeChecked", code: effect.code, open });
        });
      case "open":
        return void title.tables
          .open(effect.passcode ?? title.tables.savedPasscode())
          .then((r) =>
            dispatch(
              r.t === "opened"
                ? { t: "opened", code: r.code }
                : r.t === "passcode"
                  ? { t: "passcodeNeeded", tried: r.tried }
                  : { t: "openFailed", reason: r.reason },
            ),
          );
      case "sit":
        return title.sit(effect.code);
      case "forgetInvite":
        return title.forgetInvite();
      case "error":
        return store.events.emit({ t: "toast", text: effect.text, level: "error" });
      default:
        return effect satisfies never;
    }
  }

  // the first view's effects (checking an invite link), once
  const begun = useRef(false);
  useEffect(() => {
    if (begun.current) return;
    begun.current = true;
    for (const effect of first.effects) run(effect);
  });

  return { state, dispatch };
}

export function TitleScreen() {
  const { store, storage } = useGame();
  const [me, setMe] = useState(() => loadProfile(storage));
  const { state, dispatch } = useTitleFlow(me.saved);
  const { view } = state;

  const pick = (id: MenuId) => {
    if (id === "options" || id === "help") return store.popupOpened(id);
    dispatch({ t: "pick", item: id });
  };

  return (
    <div className={s.root} data-screen="title">
      <Body
        view={view}
        me={me}
        dispatch={dispatch}
        onPick={pick}
        onSaved={(profile) => {
          storage.setProfile(profile);
          setMe({ profile, saved: true });
          dispatch({ t: "done" });
        }}
      />
      <PasscodeDialog
        open={view.t === "opening" && view.passcode !== null}
        wrong={view.t === "opening" && !!view.passcode?.wrong}
        sending={view.t === "opening" && view.sending}
        onSubmit={(passcode) => dispatch({ t: "passcodeEntered", passcode })}
        onClose={() => dispatch({ t: "back" })}
      />
    </div>
  );
}

function Body(props: {
  view: TitleView;
  me: { profile: Profile; saved: boolean };
  dispatch(e: TitleEvent): void;
  onPick(id: MenuId): void;
  onSaved(profile: Profile): void;
}) {
  const { view, me, dispatch } = props;
  switch (view.t) {
    case "checking":
    case "sitting":
      return (
        <div className={s.center}>
          <img className={s.logoLarge} src={logo} alt="Point Poker" />
          <Spinner label={view.t === "checking" ? `Finding table ${view.code}…` : `Sitting down at ${view.code}…`} />
        </div>
      );
    case "character":
      return (
        <CharacterEditor
          initial={me.profile}
          withName
          dealer={false}
          doneLabel={doneLabel(view.next)}
          onDone={props.onSaved}
          onBack={() => dispatch({ t: "back" })}
        />
      );
    case "invite":
      return (
        <Invite
          code={view.code}
          profile={me.profile}
          onJoin={() => dispatch({ t: "joinInvite" })}
          onChange={() => dispatch({ t: "changeLook" })}
        />
      );
    case "gone":
      return <Gone code={view.code} onBack={() => dispatch({ t: "back" })} />;
    case "menu":
    case "join":
    case "opening":
      return (
        <Menu
          profile={me.profile}
          saved={me.saved}
          joining={view.t === "join" ? view : null}
          opening={view.t === "opening"}
          onPick={props.onPick}
          onCode={(code) => dispatch({ t: "codeEntered", code })}
          onBack={() => dispatch({ t: "back" })}
        />
      );
    default:
      return view satisfies never;
  }
}

const doneLabel = (next: Extract<TitleView, { t: "character" }>["next"]) =>
  next.t === "open" ? "Open the table" : next.t === "sit" ? `Join table ${next.code}` : "Done";

function Menu(props: {
  profile: Profile;
  saved: boolean;
  joining: Extract<TitleView, { t: "join" }> | null;
  opening: boolean;
  onPick(id: MenuId): void;
  onCode(code: string): void;
  onBack(): void;
}) {
  const { profile, saved, joining, onPick } = props;
  const items = MENU.map((item) => {
    if (item.id === "character") return { ...item, hint: saved ? profile.name : "Make your bean" };
    if (item.id === "open" && props.opening) return { ...item, hint: "Opening…", disabled: true };
    return item;
  });
  return (
    <section className={s.menu} aria-label="Main menu">
      <div className={s.menuShade} />
      <div className={s.menuColumn}>
        <img className={s.logo} src={logo} alt="Point Poker" />
        <MenuList label="Main menu" autoFocus={!joining} items={items} onSelect={onPick} />
      </div>
      {joining ? (
        <JoinPanel checking={joining.checking} error={joining.error} onCode={props.onCode} onBack={props.onBack} />
      ) : (
        <Me profile={profile} saved={saved} />
      )}
    </section>
  );
}

/** Your bean on its turntable, with your name under it once you have one (Character changes it). */
function Me({ profile, saved }: { profile: Profile; saved: boolean }) {
  const stage = useShowcase(profile.look, false);
  return (
    <div className={s.me}>
      <div ref={stage} className={s.meStage} aria-hidden />
      {saved && <strong className={s.nameplate}>{profile.name}</strong>}
    </div>
  );
}

function JoinPanel(props: {
  checking: string | null;
  error: string | null;
  onCode(code: string): void;
  onBack(): void;
}) {
  const [code, setCode] = useState("");
  useBack(props.onBack, true, 1);
  const full = code.length === TABLE_CODE.length;
  return (
    <div className={s.side}>
      <Panel title="Join a table">
        <p className={s.muted}>Type the code from the dealer's screen or invite link.</p>
        <CodeSlots
          label="Table code"
          value={code}
          onChange={setCode}
          onComplete={props.onCode}
          length={TABLE_CODE.length}
          alphabet={TABLE_CODE.letters}
          error={!!props.error}
          autoFocus
        />
        {props.error && (
          <p className={s.error} role="alert">
            {props.error}
          </p>
        )}
        <div className={s.row}>
          <Button variant="ghost" onPress={props.onBack}>
            Back
          </Button>
          <Button variant="primary" size="lg" disabled={!full || !!props.checking} onPress={() => props.onCode(code)}>
            {props.checking ? "Checking…" : "Join"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Invite(props: { code: string; profile: Profile; onJoin(): void; onChange(): void }) {
  const stage = useShowcase(props.profile.look, false);
  return (
    <section className={s.invite} aria-label={`Invite to table ${props.code}`}>
      <img className={s.logoSmall} src={logo} alt="Point Poker" />
      <div className={s.inviteCard}>
        <div className={s.inviteTop}>
          <p className={s.eyebrow}>You're invited to table</p>
          <p className={s.code}>{props.code}</p>
        </div>
        <div ref={stage} className={s.inviteStage} aria-hidden />
        <div className={s.inviteBottom}>
          <p className={s.inviteName}>{props.profile.name}</p>
          <Button variant="primary" size="lg" onPress={props.onJoin} autoFocus>
            Join table {props.code}
          </Button>
          <Button variant="link" onPress={props.onChange}>
            change look
          </Button>
        </div>
      </div>
    </section>
  );
}

function Gone({ code, onBack }: { code: string; onBack(): void }) {
  useBack(onBack, true, 1);
  return (
    <div className={s.center}>
      <Panel variant="neon" className={s.gone}>
        <h1 className={s.goneTitle}>This table has folded</h1>
        <p className={s.goneText}>
          Table {code} isn't open anymore. The dealer may have closed it, or the link is old.
        </p>
        <Button variant="primary" size="lg" onPress={onBack} autoFocus>
          Back to the title screen
        </Button>
      </Panel>
    </div>
  );
}

function PasscodeDialog(props: {
  open: boolean;
  wrong: boolean;
  sending: boolean;
  onSubmit(passcode: string): void;
  onClose(): void;
}) {
  const [passcode, setPasscode] = useState("");
  const submit = () => props.onSubmit(passcode);
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title="Host passcode"
      width="sm"
      actions={
        <>
          <Button variant="ghost" onPress={props.onClose}>
            Cancel
          </Button>
          <Button variant="primary" onPress={submit} disabled={props.sending || !passcode.trim()}>
            {props.sending ? "Opening…" : "Open the table"}
          </Button>
        </>
      }
    >
      <TextField
        label="Passcode"
        value={passcode}
        onChange={setPasscode}
        onSubmit={submit}
        autoFocus
        autoCapitalize="off"
        spellCheck={false}
        hint="Only needed to open a table. Ask whoever runs Point Poker."
        error={props.wrong ? "That passcode didn't work." : undefined}
      />
    </Dialog>
  );
}
