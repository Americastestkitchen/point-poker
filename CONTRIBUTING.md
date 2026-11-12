# Making changes

## Branches and environments

| Branch | What it is | Deploys to |
|---|---|---|
| `develop` | day-to-day work | **https://point-poker-dev.fly.dev**, automatically on every push |
| `main` | what's released | **https://point-poker.fly.dev**, only when a version tag is pushed |

Production saves its tables to a small disk, so a deploy only causes a few seconds of
"reconnecting…" and everyone lands back where they were. The dev site and PR previews don't
save tables: they're wiped whenever those sites redeploy or go to sleep.

## Day to day

```sh
git switch develop && git pull
# ...make changes...
npm run check            # typecheck + tests + build
git commit -am "Describe the change"
git push                 # -> CI, then deploys to the dev site
```

For bigger changes, branch off `develop` (`feature/whatever`) and open a pull request into
`develop`. Every pull request gets:
- **CI:** typecheck, tests and build.
- **A preview site:** `https://point-poker-pr-<number>.fly.dev`, linked in a PR comment. It
  redeploys on every push and is deleted when the PR closes. Previews have no Jira, so type
  tickets in by hand.

## Releasing to production

When `develop` looks good on the dev site, run one command from any branch:

```sh
npm run release              # small fixes: 0.2.0 -> 0.2.1
npm run release -- minor     # new features: 0.2.0 -> 0.3.0
```

It merges `develop` into `main`, runs the checks, bumps the version, tags it (`v0.3.0`),
pushes, and merges `main` back into `develop` so the two stay level. It refuses to run if
you have uncommitted changes or unpushed commits on `develop`, so what you release is exactly
what you tested on the dev site. GitHub Actions then:
1. checks the tag is on `main`,
2. runs typecheck, tests and build,
3. deploys production on Fly,
4. publishes a GitHub Release with notes generated from the commits since the last tag.

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
