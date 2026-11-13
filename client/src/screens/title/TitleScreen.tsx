// The title screens, over the drifting 3D room: the main menu with your bean, joining by code,
// character select, an invite link's "Join table ABCD", and an invite to a table that's gone.
// Where you are and where each choice leads is flow.ts; this draws it and runs the two things
// that leave the title screens (opening a table, sitting down) through the injected `title`.
import { useEffect, useState } from "react";
import { randomLook } from "../../../../shared/look.ts";
import type { Profile, Storage } from "../../app/storage.ts";
import { Button, CodeSlots, Dialog, KeyHint, MenuList, Panel, Spinner, TextField, useBack } from "../../ui/index.ts";
import { useGame } from "../game.tsx";
import { CharacterEditor } from "./CharacterEditor.tsx";
import { CODE_LENGTH, start, step, type Event, type View } from "./flow.ts";
import { useShowcase } from "./showcase.ts";
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

export function TitleScreen() {
  const { store, storage, title, toasts, audio } = useGame();
  const [view, setView] = useState<View>(() => start(title.invite));
  const [me, setMe] = useState(() => loadProfile(storage));
  const [opening, setOpening] = useState(false);
  /** The host passcode form is open; `wrong` once a passcode was turned down. */
  const [passcode, setPasscode] = useState<{ wrong: boolean } | null>(null);

  // the store knows when character select is up (the game and keys read `screen`)
  const inCharacter = view.t === "character";
  useEffect(() => {
    if (inCharacter) store.creatorOpened();
    else store.startShown();
  }, [inCharacter, store]);

  // an invite link is only in the address bar while it's the invite you're looking at
  const leftInvite = view.t === "menu" || view.t === "join" || view.t === "gone";
  useEffect(() => {
    if (leftInvite) title.forgetInvite();
  }, [leftInvite, title]);

  async function open(pass: string) {
    setOpening(true);
    const r = await title.tables.open(pass);
    setOpening(false);
    if (r.t === "opened") return title.sit(r.code);
    if (r.t === "passcode") return setPasscode({ wrong: r.tried });
    setPasscode(null);
    toasts.show(r.reason, { tone: "error" });
    audio.bonk();
  }

  function dispatch(e: Event, saved = me.saved) {
    const next = step(view, e, saved);
    setView(next.view);
    if (next.go?.t === "sit") title.sit(next.go.code);
    if (next.go?.t === "open") void open(title.tables.savedPasscode());
  }

  // an invite link: is its table still open? (if the server can't say, try it anyway)
  const checking = view.t === "checking" ? view.code : null;
  useEffect(() => {
    if (!checking) return;
    let live = true;
    void title.tables.check(checking).then((r) => {
      if (live) setView((v) => step(v, { t: "checked", code: checking, open: r.t !== "gone" }, me.saved).view);
    });
    return () => {
      live = false;
    };
  }, [checking, title, me.saved]);

  const pick = (id: MenuId) => {
    if (id === "options" || id === "help") return store.popupOpened(id);
    dispatch({ t: "pick", item: id });
  };

  return (
    <div className={s.root} data-screen="title">
      {view.t === "character" ? (
        <CharacterEditor
          initial={me.profile}
          withName
          dealer={false}
          doneLabel={
            view.next.t === "open" ? "Open the table" : view.next.t === "sit" ? `Join table ${view.next.code}` : "Done"
          }
          onDone={(profile) => {
            storage.setProfile(profile);
            setMe({ profile, saved: true });
            dispatch({ t: "done" }, true);
          }}
          onBack={() => dispatch({ t: "back" })}
        />
      ) : view.t === "invite" ? (
        <Invite
          code={view.code}
          profile={me.profile}
          onJoin={() => dispatch({ t: "joinInvite" })}
          onChange={() => dispatch({ t: "changeLook" })}
        />
      ) : view.t === "gone" ? (
        <Gone code={view.code} onBack={() => dispatch({ t: "back" })} />
      ) : view.t === "checking" ? (
        <div className={s.center}>
          <img className={s.logoLarge} src={logo} alt="Point Poker" />
          <Spinner label={`Finding table ${view.code}…`} />
        </div>
      ) : (
        <Menu
          profile={me.profile}
          saved={me.saved}
          joining={view.t === "join" ? view : null}
          busy={opening}
          onPick={pick}
          onJoin={(code) =>
            void title.tables.check(code).then((r) => dispatch({ t: "joinTyped", code, open: r.t !== "gone" }))
          }
          onBack={() => dispatch({ t: "back" })}
        />
      )}
      <PasscodeDialog
        open={passcode !== null}
        wrong={passcode?.wrong ?? false}
        busy={opening}
        onSubmit={(pass) => void open(pass)}
        onClose={() => setPasscode(null)}
      />
    </div>
  );
}

function Menu(props: {
  profile: Profile;
  saved: boolean;
  joining: Extract<View, { t: "join" }> | null;
  busy: boolean;
  onPick(id: MenuId): void;
  onJoin(code: string): void;
  onBack(): void;
}) {
  const { profile, saved, joining, onPick } = props;
  return (
    <section className={s.menu} aria-label="Main menu">
      <div className={s.menuShade} />
      <div className={s.menuColumn}>
        <img className={s.logo} src={logo} alt="Point Poker" />
        <MenuList
          label="Main menu"
          autoFocus={!joining}
          items={MENU.map((item) =>
            item.id === "character"
              ? { ...item, hint: saved ? profile.name : "Make your bean" }
              : item.id === "open" && props.busy
                ? { ...item, hint: "Opening…", disabled: true }
                : item,
          )}
          onSelect={onPick}
        />
        <div className={s.hints}>
          <KeyHint keys={["ArrowUp", "ArrowDown"]}>move</KeyHint>
          <KeyHint keys={["Enter"]}>pick</KeyHint>
        </div>
      </div>
      {joining ? (
        <JoinPanel error={joining.error} onJoin={props.onJoin} onBack={props.onBack} />
      ) : (
        <Me profile={profile} saved={saved} onChange={() => onPick("character")} />
      )}
    </section>
  );
}

/** Your bean on its turntable, with your name under it. */
function Me({ profile, saved, onChange }: { profile: Profile; saved: boolean; onChange(): void }) {
  const stage = useShowcase(profile.look, false);
  return (
    <div className={s.me}>
      <div ref={stage} className={s.meStage} aria-hidden />
      <div className={s.nameplate}>
        {saved && <strong>{profile.name}</strong>}
        <Button variant="link" size="sm" onPress={onChange}>
          {saved ? "change look" : "make your bean"}
        </Button>
      </div>
    </div>
  );
}

function JoinPanel({ error, onJoin, onBack }: { error: string | null; onJoin(code: string): void; onBack(): void }) {
  const [code, setCode] = useState("");
  useBack(onBack, true, 1);
  const full = code.length === CODE_LENGTH;
  return (
    <div className={s.side}>
      <Panel title="Join a table">
        <p className={s.muted}>Type the code from the dealer's screen or invite link.</p>
        <CodeSlots label="Table code" value={code} onChange={setCode} onComplete={onJoin} error={!!error} autoFocus />
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <div className={s.row}>
          <Button variant="ghost" onPress={onBack}>
            Back
          </Button>
          <Button variant="primary" size="lg" disabled={!full} onPress={() => onJoin(code)}>
            Join
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Invite({
  code,
  profile,
  onJoin,
  onChange,
}: {
  code: string;
  profile: Profile;
  onJoin(): void;
  onChange(): void;
}) {
  const stage = useShowcase(profile.look, false);
  return (
    <section className={s.invite} aria-label={`Invite to table ${code}`}>
      <img className={s.logoSmall} src={logo} alt="Point Poker" />
      <div className={s.inviteCard}>
        <div className={s.inviteTop}>
          <p className={s.eyebrow}>You're invited to table</p>
          <p className={s.code}>{code}</p>
        </div>
        <div ref={stage} className={s.inviteStage} aria-hidden />
        <div className={s.inviteBottom}>
          <p className={s.inviteName}>{profile.name}</p>
          <Button variant="primary" size="lg" onPress={onJoin} autoFocus>
            Join table {code}
          </Button>
          <Button variant="link" onPress={onChange}>
            change look
          </Button>
          <div className={s.hints}>
            <KeyHint keys={["Enter"]}>join</KeyHint>
          </div>
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
  busy: boolean;
  onSubmit(pass: string): void;
  onClose(): void;
}) {
  const [pass, setPass] = useState("");
  const submit = () => {
    if (pass.trim()) props.onSubmit(pass.trim());
  };
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
          <Button variant="primary" onPress={submit} disabled={props.busy || !pass.trim()}>
            {props.busy ? "Opening…" : "Open the table"}
          </Button>
        </>
      }
    >
      <TextField
        label="Passcode"
        value={pass}
        onChange={setPass}
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
