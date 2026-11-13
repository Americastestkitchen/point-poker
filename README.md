<img src="assets/icon.svg" width="64" height="64" alt="">

# Point Poker

A silly 3D story-point poker game for our standups. The dealer puts a Jira ticket on the
table, everyone secretly plays a card (1, 2, 3, 5, 8), the cards flip, and the dealer
calls the final points. The closest guess wins the pot.

- **Live:** https://point-poker.fly.dev
- **Dev (latest `main`):** https://point-poker-dev.fly.dev

## Start here

### Where things live

| Thing                               | Where                                       | You need access?                  |
| ----------------------------------- | ------------------------------------------- | --------------------------------- |
| Code                                | this GitHub repo                            | Yes: ask Jair to add you          |
| Live and dev sites                  | [Fly.io](https://fly.io), a hosting service | No: GitHub deploys for you        |
| Tickets                             | Jira (the game only **reads** it)           | Only to show real tickets locally |
| Secrets (Jira token, host passcode) | Fly, plus `.env.local` on your machine      | Ask Jair if you need them         |

### How a change reaches people

```
you push to main ──▶ dev site updates (about 1 min)
npm run release ──▶ live site updates + a GitHub Release
you open a pull request (optional) ──▶ its own preview site
```

Everything in that path is automatic. See [CONTRIBUTING.md](CONTRIBUTING.md) for the exact commands.

### Run it on your machine

```sh
npm install
npm run build
npm start                  # http://localhost:8787
```

That's enough to play with hand-typed tickets. To show real Jira tickets, create
`.env.local` (it's never committed):

```
JIRA_BASE_URL=https://yoursite.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=...         # make one at id.atlassian.com → Security → API tokens
HOST_PASSCODE=...          # anything; you type it when opening a table
```

For hot reload while coding, run `npm run dev:server` and `npm run dev` together.

### Good to know

- **Never write to Jira.** The game only reads tickets, and that's on purpose. Points get
  entered in Jira by a person.
- **Releasing is safe mid-game.** The live site saves its tables, so a release just causes a
  few seconds of "reconnecting…". The dev site and previews don't save tables.
- **Secrets never go in the repo.** If you see a token in a diff, stop and tell someone.

### Where to go next

- [CONTRIBUTING.md](CONTRIBUTING.md): branches, releasing, secrets and the UI gallery.
- [AGENTS.md](AGENTS.md): feature integration recipes and the planned screen contract.
- [GitHub issues](https://github.com/JaiiR320/point-poker/issues): what we're thinking about next.
- The code: `shared/protocol.ts` (the messages between server and browser, as Zod schemas)
  is the best place to start reading. Next to it, `shared/rules.ts` has the rules both sides
  use, `shared/look.ts` what a bean looks like, and `shared/catalog/` the content (decks,
  colours, bodies, hats, emotes, environments). Then:
  - `server/main.ts` reads the environment and wires everything together.
  - `server/table/` is one poker table: its state, rules, commands, payouts (`coins.ts`) and
    the round's state machine (`round.ts`: which moves each phase allows).
    It's plain logic with unit tests, no sockets. Every command a player can send is one
    `defineCommand()` in `commands.ts`; the client imports their types from there.
  - `server/tickets/` (Jira, or none), `server/store/` (saving tables), `server/auth/`
    (the host passcode) and `server/transport/` (HTTP and WebSocket) are the adapters.
  - `client/src/main.ts` builds the browser side the same way. `client/src/app/` holds the
    store, view diffing and the event stream (`events.ts`), `actions`, the session
    (socket + reconnect) and storage.
    The 3D world (`scene/`, `avatar/`, `environments/`) and the UI (`screens/`, `lobby.ts`,
    `ui/`) have separate roles: world, game screens and the legacy lobby read the store, call
    `actions` and use the event stream. `screens/` is the in-game HUD, built with the kit. The generic React kit in `ui/` takes props and injected
    services; it imports no app/game code. Its gallery alone wires app storage and audio.
    World and UI do not import each other (bar the lobby's preview, until #4).
    `test/boundaries.test.ts` checks these import rules.
  - `client/src/scene/layout/layout.ts` says where everything goes (seats, cards,
    the ticket, the pot, props). `client/src/environments/` says how it looks: the Backlog Basement lives in
    `environments/basement/`, and a new place is a new folder there.
  - `client/src/avatar/` is the bean: one file per body shape in `bodies/`, one per hat in
    `cosmetics/`, the parts every bean has (face, arms, labels, chair) in `parts/`, and an
    `animator` that works out every pose. `createAvatar(look)` puts it all together.
  - `client/src/scene/` is grouped by job: `engine/` (renderer, picking, input, camera),
    `layout/`, `table/` (seats, cards, chips, the pot, the ticket) and `art/` (materials,
    canvas textures).
  - `test/session.test.ts` plays a whole game against the real server.
  - `*.test-d.ts` files check what the types infer (only `npm run typecheck` runs them), with
    the helpers in `test/types.ts`.

## How to play

- **Dealer:** open a table (needs the host passcode) and share the invite link. Then add a
  ticket (or an epic, to queue its children), reveal the cards, and pick the final points.
- **Players:** open the invite link, pick a body, colour and hat, and click a card.
  Drag to look around, use Z X C V to emote, click someone to throw a chip, and click the duck.
