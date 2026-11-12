<img src="assets/icon.svg" width="64" height="64" alt="">

# Point Poker

Story-point poker in a dingy 3D basement. The dealer puts a Jira ticket (or an epic) on the table, everyone secretly plays a Fibonacci card, the cards flip, and the dealer sets the final points. Closest guess takes the pot (the sum of all cards) as long as it is within one card of the final call, otherwise the house keeps it; ties split it.

## Run

```sh
npm install
npm run build
npm start            # http://localhost:8787
```

`.env.local` (gitignored):

```
JIRA_BASE_URL=https://yoursite.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=...
HOST_PASSCODE=...          # needed to open a table; players only need the invite link
JIRA_POINTS_FIELD=customfield_10004   # optional
JIRA_PROJECT=SD                       # optional, for "Sprint tickets"
```

Jira access is read-only (GET requests only). Without Jira settings the dealer can type tickets in by hand.

Dev mode with hot reload: `npm run dev:server` and `npm run dev` (Vite proxies `/api` and `/ws`).

## Play

- **Dealer:** "Open a table", copy the invite link, paste a ticket or epic link, Deal → Reveal → pick final points → Settle → Next. An epic loads its child tickets as a queue.
- **Players:** open the link, pick a name/colour/hat, click a card (or ←/→ + Enter). Drag to look around, Z X C V to emote, click someone to flick a chip at their head, and click the duck to make it squeak.
