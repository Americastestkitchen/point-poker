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

`npm run lint` (oxlint) on its own takes about a second; every finding is an error, see [AGENTS.md](AGENTS.md) for how to fix one.

If you move a seat, prop or body anchor on purpose, run `npm run test:update-snapshots` to re-pin the positions and commit the updated `.snapshot` files.

For a bigger or riskier change, use a branch and open a pull request instead. It gets its own
preview site, linked in a PR comment, which redeploys on every push and is deleted when the PR
closes. Previews have no Jira, so type tickets in by hand.

## UI kit

The React UI kit in `client/src/ui/` supplies the primitives the game screens in
`client/src/screens/` (title screens and HUD) are built from.
The 3D world stays plain Three.js.
See [AGENTS.md](AGENTS.md) for the screen integration contract. Colours, fonts, spacing
and glows live in `client/src/ui/tokens.ts` only: the kit's and the screens' stylesheets use the
`--pp-*` variables, and a test fails on raw colours. To see every primitive in every state, run `npm run dev` and open
`/gallery.html`. `npm run check` also builds it to `node_modules/.gallery`; the game
build in `dist` excludes it.

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

## Secrets

- **Fly (runtime):** `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` and `HOST_PASSCODE` are set
  per app with `fly secrets set -a point-poker` / `-a point-poker-dev`.
- **GitHub (deploys):** `FLY_API_TOKEN_DEV` and `FLY_API_TOKEN_PROD` are app-scoped Fly deploy tokens.
  `FLY_API_TOKEN_PREVIEW` can create and delete apps in the Fly org, which previews need.
  `HOST_PASSCODE` is copied to each preview.
- **Local:** use `.env.local` (gitignored) for `npm start`.

## Handy commands

```sh
fly logs -a point-poker               # production logs (pointed tickets show up as POINTED {...})
fly logs -a point-poker-dev           # dev logs
gh run list                           # recent CI and deploy runs
```
