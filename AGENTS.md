# Working on Point Poker

This file holds what the code can't tell you. For structure, read the code: file headers
say what each module is for, and `test/boundaries.test.ts` lists the import rules with the
reason for each. [CONTRIBUTING.md](CONTRIBUTING.md) covers deploys, releases and secrets.

## What this is

A story-point poker game one team plays in its standups. It should feel like a goofy
video game, not a planning tool: the menus, sounds, beans and coins are the point. The
people playing are teammates on a call. Opening a table is guarded (it reaches Jira);
sitting down only takes the invite link.

## Constraints from outside the code

- **Jira writes are deliberate.** A table reads Jira as the dealer who opened it, through
  their own Atlassian sign-in. The only write that is agreed is the points a table settles
  on (#17), and it isn't built yet. Any other write needs a decision first. The shared API
  token with `HOST_PASSCODE` remains as the fallback for local development: never write
  with it.
- **Until #17 lands, the only record of final points is the server log** (`POINTED {...}`
  lines in `fly logs`). A person copies points into Jira by hand, and the PM's main
  complaint is that points don't reach the ticket. Keep that log line working.
- **Dealers stay signed in for up to 90 days.** Adding an OAuth scope or changing
  `TOKEN_KEY` signs every dealer out, so do either only when it is worth that.
- **A push to `main` is a deploy.** It updates the dev site within a minute. A pull request
  creates a public preview site. Neither needs approval, so don't push unasked.
- **Production is one machine, on purpose.** Tables live in memory, so a second machine
  would split players between them. Nothing may assume more than one process.
- **Releases happen mid-game.** Production saves tables to disk and restores them after a
  deploy, and players reconnect on their own. Two things follow:
  - A saved table that no longer parses as `TableState` is dropped, which ends that game.
    When you change the saved shape, keep old saves loadable (optional fields, defaults).
  - Open tabs keep running the old client against the new server until they reload. A
    protocol change that breaks old clients breaks games in progress.
- **The dev site and previews forget their tables** when they redeploy or sleep. Previews
  and local runs sign in to Jira through the dev site's callback, so the dev site must keep
  relaying them (`ATLASSIAN_RELAY`); don't add callback URLs to the Atlassian app for them.

## Where it's heading

These areas are open questions, so don't build on their current shape more than you need to:
the coin economy (#15), what the dealer is and can do (#18, #9), table setup and a lobby
with other decks (#14), and switching rooms (#10: only the Basement exists and it is
hard-wired). Items, face accessories and a first-person body are planned (#5 to #8).
[Issues](https://github.com/Americastestkitchen/point-poker/issues) are the only backlog; there is no
TODO file.

## Rules no test checks

- The server's view is the truth. Screens derive what they show from the store during
  render and never copy room, player or phase state into component state.
- Store writes go through named methods. Add a new one rather than a general setter.
- Camera and animation values stay in the frame loop, out of the store and React.
- An action's error shows in its form or as a toast, never both.
- The kit owns Escape and focus. Don't add global key handlers; the world takes keys only
  when `screens/keys.ts` allows it.
- The `ui/` kit stays generic. Anything that knows about the game belongs in `screens/`.
  A new primitive gets an example in the gallery.
- When a boundary or lint rule fails, fix the cause. Don't add an exception, `!`, `as` or
  `any`, and don't hide a broken invariant: report it.
- A change to seat, prop or anchor positions fails the snapshot tests. If the move is
  intended, run `npm run test:update-snapshots` and commit the `.snapshot` files.

## Finishing a change

Run `npm run format`, then `npm run check`. It is the same check CI runs, and it must pass
before a push because `main` deploys.

Commit and pull request titles say what changed for the player, in plain words: "The ticket
tab doesn't flash dark when hovered". Pull requests are squash-merged, and the body explains
behaviour the same way. In-game text follows that voice too: short, friendly, a little silly.
