# Making changes

## How it fits together

There's one branch, `main`.

| When                               | What happens                                                             | Where                                     |
| ---------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| you push to `main`                 | checks run, then the dev site updates                                    | **https://point-poker-dev.fly.dev**       |
| you run `npm run release`          | checks run, then the live site updates and a GitHub Release is published | **https://point-poker.fly.dev**           |
| you open a pull request (optional) | checks run, then a preview site is created                               | `https://point-poker-pr-<number>.fly.dev` |

Production saves its tables to a small disk, so a release only causes a few seconds of
"reconnecting…" and everyone lands back where they were. The dev site and previews don't
save tables: they're wiped whenever those sites redeploy or go to sleep.

## Day to day

```sh
git pull
# ...make changes...
npm run format           # oxfmt rewrites the files to the one house style
npm run check            # format check + lint + typecheck + tests + build (+ bundles the UI kit gallery)
git commit -am "Describe the change"
git push                 # -> dev site updates in about a minute
```

`npm run lint` (oxlint) takes about a second on its own, and every finding is an error.

If you move a seat, prop or body anchor on purpose, run `npm run test:update-snapshots` to re-pin the positions and commit the updated `.snapshot` files.

For a bigger or riskier change, use a branch and open a pull request instead. It gets its own
preview site, linked in a PR comment, which redeploys on every push and is deleted when the PR
closes. Previews sign in to Jira through the dev site (see [Jira sign-in](#jira-sign-in)).

## UI kit

The React kit in `client/src/ui/` holds the primitives the game screens in `client/src/screens/`
are built from; the 3D world stays plain Three.js. Colours, fonts, spacing and glows live only in
`client/src/ui/tokens.ts`, used as `--pp-*` CSS variables, and a test fails on raw colours. To see
every primitive in every state, run `npm run dev` and open `/gallery.html`.

## Logo

The neon logo and the poker-chip mark are drawn once, as tube shapes in `shared/brand.ts`. The room's
sign draws those shapes in 3D, and `npm run brand` writes every file made from them: `assets/logo.svg`,
`assets/mark.svg`, the favicons, `apple-touch-icon.png` and the `og.png` link preview in `client/public/`.
After changing a shape, run it and commit the files; a test fails while the SVGs are out of date. The PNGs
need `rsvg-convert` (`brew install librsvg` or `apt install librsvg2-bin`).

## Releasing

When the dev site looks good, run this from `main`:

```sh
npm run release              # small fixes: 0.2.0 -> 0.2.1
npm run release -- minor     # new features: 0.2.0 -> 0.3.0
```

It runs the checks, bumps the version, tags it (like `v0.3.0`) and pushes. It refuses to run if
you have uncommitted or unpushed work, so what you release is what you tried on the dev site.
GitHub Actions then:

1. checks the tag is on `main`,
2. runs typecheck, tests and build,
3. deploys production on Fly,
4. publishes a GitHub Release with notes generated from the commits since the last release.

A release can land in the middle of a game. Saved tables in an old format are dropped, and open
tabs keep the old client until they reload, so keep both compatible (see [AGENTS.md](AGENTS.md)).

## Secrets

- **Fly (runtime):** the deploy workflows copy these from GitHub secrets onto each app, so
  nobody runs `fly secrets set` for them:
  - `ATLASSIAN_CLIENT_ID`, `ATLASSIAN_CLIENT_SECRET`: the Atlassian app (see below).
  - `JIRA_SITES`: the Jira site hosts tables may use, comma-separated
    (`bostoncommonpress.atlassian.net`). Without it any Atlassian account could open a table.
  - `TOKEN_KEY` (production only, from the `TOKEN_KEY_PROD` secret): seals dealers' Jira
    sign-ins on the `/data` volume. Changing it signs everyone out. The dev site keeps no volume,
    so its sign-ins last until it sleeps.
  - Optional, by hand with `fly secrets set`: `JIRA_POINTS_FIELD` (story points field ID),
    `JIRA_PROJECT` (default project), and `HOST_PASSCODE` for an app without Jira sign-in.
- **GitHub (deploys):** `FLY_API_TOKEN_DEV` and `FLY_API_TOKEN_PROD` are app-scoped Fly deploy tokens.
  `FLY_API_TOKEN_PREVIEW` can create and delete apps in the Fly org, which previews need.
  `ATLASSIAN_CLIENT_ID`, `ATLASSIAN_CLIENT_SECRET` and `JIRA_SITES` are copied to dev, production
  and each preview, and `TOKEN_KEY_PROD` to production
  (without them, previews fall back to `HOST_PASSCODE` and hand-typed tickets).
- **Local:** use `.env.local` (gitignored) for `npm start` and `npm run dev:server`. See
  [Jira locally](#jira-locally).

## Jira sign-in

Dealers sign in with their own Jira account (Atlassian OAuth 2.0, "3LO") when they open a
table; players never do. The server keeps each dealer's refresh token sealed with `TOKEN_KEY`,
and the browser only gets a session cookie, so dealers stay signed in for up to 90 days of not
playing. Signing out (on the title screen) forgets the login, and that dealer's tables go back
to hand-typed tickets.

The app lives at [developer.atlassian.com/console/myapps](https://developer.atlassian.com/console/myapps/):

- **Permissions:** Jira API `read:jira-work`, `read:jira-user`, `write:jira-work`; Jira Software
  `read:sprint:jira-software`, `read:board-scope:jira-software`; User identity API `read:me`.
  `offline_access` isn't in the console: the server asks for it. Adding a scope later makes every
  dealer sign in again; the list is `SCOPES` in `server/auth/atlassian.ts`.
- **Authorization → callback URLs:** only `https://point-poker.fly.dev/auth/jira/callback` and
  `https://point-poker-dev.fly.dev/auth/jira/callback`. Atlassian only accepts exact URLs, so PR
  previews and local runs sign in through the dev site: they send `ATLASSIAN_CALLBACK_URL` (the
  dev site's) to Atlassian, and the dev site passes the answer on to any address matching
  `ATLASSIAN_RELAY` in `fly.dev.toml`: previews, `http://localhost:<port>` and `https://*.ts.net`
  addresses. Only a one-time code passes through, and trading it for tokens takes the client
  secret, so a new address means widening `ATLASSIAN_RELAY` (and its test in
  `test/relay.test.ts`), never adding a callback to the app.
- **Distribution:** sharing on, or only the app's owner can sign in.

### Jira locally

Most changes don't need Jira sign-in. Leave the Atlassian variables out of `.env.local`, and
opening a table asks for nothing (or for `HOST_PASSCODE`, if you set one). Add
`JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN` (your own
[API token](https://id.atlassian.com/manage-profile/security/api-tokens)) to load real tickets.
That token only ever reads: never write to Jira with it.

To work on sign-in itself, sign in through the dev site like a preview does:

```sh
ATLASSIAN_CLIENT_ID=...
ATLASSIAN_CLIENT_SECRET=...
ATLASSIAN_CALLBACK_URL=https://point-poker-dev.fly.dev/auth/jira/callback
JIRA_SITES=bostoncommonpress.atlassian.net
TOKEN_KEY=any-long-random-string   # optional: stay signed in across restarts (kept in .data/)
```

This works on `npm start` (port 8787), `npm run dev` (Vite's port) and a Tailscale address,
because the dev site passes the sign-in back to wherever it started.

## Handy commands

```sh
fly logs -a point-poker               # production logs (pointed tickets show up as POINTED {...})
fly logs -a point-poker-dev           # dev logs
gh run list                           # recent CI and deploy runs
```
