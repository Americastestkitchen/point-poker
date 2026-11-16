// The action dock (region "dock", bottom centre): what you can do this phase. dock.ts decides
// what shows (title, hand, buttons); this draws it and sends the presses through actions.
// In the lobby it holds the dealer's Start (where Reveal will be), and a player's way to their
// look while they wait. The dealer sets the table up in the dealer menu.
// It stays within the inherited --dock-max height, so the table stays clear.
import { Button, ButtonLink, cx, Spinner } from "../../ui/index.ts";
import { useAppState, useGame, usePopup, useRoom, useTicketLoad } from "../game.tsx";
import { nextInQueue } from "../../../../shared/rules.ts";
import { skipPlan } from "../dealer/panel.ts";
import { PlayerDot } from "../parts/PlayerDot.tsx";
import { dockModel, type DockAction, type DockBody, type HandCard, type Words } from "./dock.ts";
import { Hand } from "./Hand.tsx";
import s from "./ActionDock.module.css";

export function ActionDock() {
  const room = useRoom();
  const meId = useAppState((st) => st.me?.id);
  const myVote = useAppState((st) => st.ui.myVote);
  if (!room) return null;
  const dock = dockModel({ room, meId, myVote });
  if (!dock.title && !dock.body && !dock.actions.length) return null;
  return (
    // a new phase or round deals the dock in again
    <section key={dock.key} className={s.dock} aria-label="Your move">
      {dock.title && (
        <p className={s.title}>
          <Said words={dock.title} />
        </p>
      )}
      {/* the lobby's dock stacks: the one big thing, its quiet links in a row under it */}
      <div className={cx(s.row, !room.started && s.stack)}>
        {dock.body && <Body body={dock.body} />}
        {dock.actions.length > 0 && (
          <div className={s.side}>
            {dock.actions.map((a) => (
              <Action key={a.t} action={a} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Said({ words }: { words: Words }) {
  return words.map((w, i) =>
    typeof w === "string" ? (
      w
    ) : (
      // oxlint-disable-next-line react/no-array-index-key -- a part of a fixed sentence is its position
      <b key={i} className={s.strong}>
        {w.strong}
      </b>
    ),
  );
}

function Body({ body }: { body: DockBody }) {
  const { actions, ticketLoad } = useGame();
  const picker = usePopup("picker");
  const room = useRoom();
  const load = useTicketLoad();
  const press = (c: HandCard) => {
    if (c.press?.t === "vote") actions.vote(c.press.value);
    else if (c.press?.t === "settle") actions.dealer.settle(c.press.value);
  };
  switch (body.t) {
    case "start": {
      const first = room ? nextInQueue(room) : undefined;
      return (
        <Button
          variant="primary"
          size="lg"
          className={s.big}
          disabled={load.status === "loading"}
          sub={`${body.players} at the table`}
          onPress={() => {
            // with tickets lined up the first one is dealt, so it waits like any other ticket load
            if (first) ticketLoad.run(actions.dealer.wait.start(), `Dealing ${first.key}…`);
            else actions.dealer.start();
          }}
        >
          Start the game
        </Button>
      );
    }
    case "addTicket":
      return (
        <Button variant="primary" size="lg" className={s.add} onPress={picker.show}>
          ＋ Add a Jira ticket
        </Button>
      );
    case "waiting":
      return (
        <div className={s.waiting}>
          <Spinner label={body.text} />
        </div>
      );
    case "vote":
      return <Hand cards={body.cards} label="Your cards" onPress={press} />;
    case "change":
      return <Hand cards={body.cards} label="Change your card" settle onPress={press} />;
    case "settle":
      return <Hand cards={body.cards} label="Final points" settle onPress={press} />;
    case "spread":
      return body.cards.length ? (
        <ul className={s.spread} aria-label="Votes">
          {body.cards.map((c) => (
            <li
              key={c.value}
              className={cx(s.mini, c.final && s.final)}
              aria-label={`${c.label}: ${c.voters.length ? c.voters.map((p) => p.name).join(", ") : "nobody"}${c.final ? " (final)" : ""}`}
            >
              <span className={s.miniValue} aria-hidden>
                {c.label}
              </span>
              <span className={s.miniDots} aria-hidden>
                {c.voters.map((p) => (
                  <PlayerDot key={p.id} player={p} size="sm" />
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={s.waiting}>Nobody voted</div>
      );
  }
}

function Action({ action }: { action: DockAction }) {
  const { actions, ticketLoad, store } = useGame();
  const picker = usePopup("picker");
  const load = useTicketLoad();
  const room = useRoom();
  switch (action.t) {
    case "reveal":
      return (
        <Button
          variant="primary"
          size="lg"
          className={cx(s.big, action.everyone && s.pulse)}
          disabled={action.voted === 0}
          sub={`${action.voted} of ${action.of} in`}
          onPress={() => actions.dealer.reveal()}
        >
          Reveal cards
        </Button>
      );
    case "restart":
      return (
        <Button variant="link" size="sm" className={s.link} onPress={() => actions.dealer.deal()}>
          {action.label}
        </Button>
      );
    case "skip":
      return (
        <Button
          variant="link"
          size="sm"
          className={s.link}
          disabled={load.status === "loading"}
          onPress={() => {
            if (!room) return;
            const plan = skipPlan(room);
            if (plan.t === "load") ticketLoad.run(actions.dealer.wait.skip(), plan.text);
            else actions.dealer.skip();
          }}
        >
          Skip ticket
        </Button>
      );
    case "next": {
      const busy = load.status === "loading";
      return (
        <Button
          variant="primary"
          size="lg"
          className={s.big}
          disabled={busy}
          sub={busy ? "Dealing…" : action.key}
          onPress={() => ticketLoad.run(actions.dealer.wait.next(), "Dealing the next ticket…")}
        >
          Next ticket →
        </Button>
      );
    }
    case "picker":
      return action.main ? (
        <Button variant="primary" size="lg" className={s.big} onPress={picker.show}>
          ＋ Next ticket
        </Button>
      ) : (
        <Button variant="link" size="sm" className={s.link} onPress={picker.show}>
          Choose a different one
        </Button>
      );
    case "look":
      return <Button onPress={() => store.lookOpened()}>👕 Change my look</Button>;
    case "jira":
      return (
        <ButtonLink href={action.url} variant="link" size="sm" className={s.link}>
          Open in Jira ↗
        </ButtonLink>
      );
  }
}
