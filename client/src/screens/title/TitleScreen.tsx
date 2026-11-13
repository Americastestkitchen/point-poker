// The title screens, over the drifting 3D room: the main menu with your bean, joining by code,
// opening a table (signing in with Jira first), character select, an invite link's "Join table ABCD", and an invite to a
// table that's gone. flow.ts decides where each choice leads; this draws the view and runs the
// effects it asks for (asking the server, sitting down) through the `title` it's given.
import { useEffect, useState, useSyncExternalStore } from "react";
import { randomLook } from "../../../../shared/look.ts";
import { TABLE_CODE } from "../../../../shared/rules.ts";
import type { Profile, Storage } from "../../app/storage.ts";
import { Button, CodeSlots, Dialog, MenuList, Panel, Spinner, TextField, useBack } from "../../ui/index.ts";
import { CharacterEditor } from "../character/CharacterEditor.tsx";
import { useShowcase } from "../character/showcase.ts";
import { useGame } from "../game.tsx";
import type { OpenAsk, TitleEvent, TitleView } from "./flow.ts";
import { createTitleFlow, type Title } from "./runner.ts";
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
 * The title flow for this screen: built once, attached while the screen is up, read the React
 * way. "Saved profile" lives in the flow's state only.
 */
function useTitleFlow(title: Title, saved: boolean) {
  const { store } = useGame();
  const [flow] = useState(() =>
    createTitleFlow({
      title,
      saved,
      error: (text) => store.events.emit({ t: "toast", text, level: "error" }),
    }),
  );
  useEffect(() => {
    flow.attach();
    return () => flow.detach();
  }, [flow]);
  const state = useSyncExternalStore(flow.subscribe, flow.getState);
  return { state, dispatch: flow.dispatch };
}

export function TitleScreen({ title }: { title: Title }) {
  const { store, storage } = useGame();
  const [first] = useState(() => loadProfile(storage));
  /** Your bean as you last saved it (or a fresh random one): a draft for character select. */
  const [profile, setProfile] = useState(first.profile);
  const { state, dispatch } = useTitleFlow(title, first.saved);
  const { view, saved } = state;

  const pick = (id: MenuId) => {
    if (id === "options" || id === "help") return store.popupOpened(id);
    dispatch({ t: "pick", item: id });
  };

  return (
    <div className={s.root} data-screen="title">
      <Body
        title={title}
        view={view}
        profile={profile}
        saved={saved}
        dispatch={dispatch}
        onPick={pick}
        onSaved={(profile) => {
          storage.setProfile(profile);
          setProfile(profile);
          dispatch({ t: "done" });
        }}
      />
      <OpenDialogs
        ask={view.t === "opening" ? view.ask : null}
        sending={view.t === "opening" && view.sending}
        dispatch={dispatch}
      />
    </div>
  );
}

function Body(props: {
  title: Title;
  view: TitleView;
  profile: Profile;
  saved: boolean;
  dispatch(e: TitleEvent): void;
  onPick(id: MenuId): void;
  onSaved(profile: Profile): void;
}) {
  const { title, view, profile, saved, dispatch } = props;
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
          initial={profile}
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
          profile={profile}
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
          title={title}
          profile={profile}
          saved={saved}
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
  title: Title;
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
        <JiraAccount title={props.title} />
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

/** Who's signed in to Jira on this browser, with Sign out; nothing when nobody is (or there's no sign-in). */
function JiraAccount({ title }: { title: Title }) {
  const { store } = useGame();
  // asked once per visit to the menu; signing out changes it here
  const [user, setUser] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void title.tables.host().then((info) => {
      if (live) setUser(info?.user?.name ?? null);
    });
    return () => {
      live = false;
    };
  }, [title]);
  if (!user) return null;
  const signOut = () =>
    void title.tables.signOut().then((ok) => {
      if (ok) setUser(null);
      else store.events.emit({ t: "toast", text: "Couldn't sign out of Jira. Try again.", level: "error" });
    });
  return (
    <p className={s.account}>
      Signed in to Jira as <strong>{user}</strong>
      <Button variant="link" onPress={signOut}>
        Sign out
      </Button>
    </p>
  );
}

/** What opening a table asks of you first: the host passcode, a Jira sign-in, or a Jira site. */
function OpenDialogs({
  ask,
  sending,
  dispatch,
}: {
  ask: OpenAsk | null;
  sending: boolean;
  dispatch(e: TitleEvent): void;
}) {
  const close = () => dispatch({ t: "back" });
  return (
    <>
      <PasscodeDialog
        open={ask?.t === "passcode"}
        wrong={ask?.t === "passcode" && ask.wrong}
        sending={sending}
        onSubmit={(passcode) => dispatch({ t: "passcodeEntered", passcode })}
        onClose={close}
      />
      <Dialog
        open={ask?.t === "signIn"}
        onClose={close}
        title="Sign in with Jira"
        width="sm"
        actions={
          <>
            <Button variant="ghost" onPress={close}>
              Cancel
            </Button>
            <Button variant="primary" onPress={() => dispatch({ t: "signIn" })} disabled={sending} autoFocus>
              {sending ? "Going to Atlassian…" : "Sign in with Jira"}
            </Button>
          </>
        }
      >
        <p className={s.muted}>
          The dealer loads tickets with their own Jira account. You stay signed in on this browser until you sign out.
          Players never need to sign in.
        </p>
      </Dialog>
      <Dialog open={ask?.t === "site"} onClose={close} title="Which Jira?" width="sm">
        <p className={s.muted}>Your account can see more than one Jira site. Pick the one this table uses.</p>
        <MenuList
          label="Jira sites"
          autoFocus
          items={(ask?.t === "site" ? ask.sites : []).map((site) => ({
            id: site.id,
            label: site.name || new URL(site.url).host,
            hint: new URL(site.url).host,
            disabled: sending,
          }))}
          onSelect={(site) => dispatch({ t: "siteChosen", site })}
        />
      </Dialog>
    </>
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
