<img src="assets/icon.svg" width="64" height="64" alt="">

# Point Poker

A silly 3D story-point poker game for our standups. The dealer puts a Jira ticket on the
table, everyone secretly plays a card (1, 2, 3, 5, 8), the cards flip, and the dealer
calls the final points. The closest guess wins the pot.

- **Live:** https://point-poker.fly.dev
- **Dev (latest `main`):** https://point-poker-dev.fly.dev

## Start here

### Where things live

| Thing | Where | You need access? |
|---|---|---|
| Code | this GitHub repo | Yes: ask Jair to add you |
| Live and dev sites | [Fly.io](https://fly.io), a hosting service | No: GitHub deploys for you |
| Tickets | Jira (the game only **reads** it) | Only to show real tickets locally |
| Secrets (Jira token, host passcode) | Fly, plus `.env.local` on your machine | Ask Jair if you need them |

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

- [CONTRIBUTING.md](CONTRIBUTING.md): branches, releasing, secrets.
- [GitHub issues](https://github.com/JaiiR320/point-poker/issues): what we're thinking about next.
- The code: `shared/protocol.ts` (the messages between server and browser, as Zod schemas)
  is the best place to start reading. Then:
  - `server/main.ts` reads the environment and wires everything together.
  - `server/table/` is one poker table: its state, rules, commands and payouts (`coins.ts`).
    It's plain logic with unit tests, no sockets.
  - `server/tickets/` (Jira, or none), `server/store/` (saving tables), `server/auth/`
    (the host passcode) and `server/transport/` (HTTP and WebSocket) are the adapters.
  - `client/` is the 3D table and UI.
  - `test/session.test.ts` plays a whole game against the real server.

## How to play

- **Dealer:** open a table (needs the host passcode) and share the invite link. Then add a
  ticket (or an epic, to queue its children), reveal the cards, and pick the final points.
- **Players:** open the invite link, pick a body, colour and hat, and click a card.
  Drag to look around, use Z X C V to emote, click someone to throw a chip, and click the duck.
