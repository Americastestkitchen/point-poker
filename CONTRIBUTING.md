# Making changes

## How it fits together

There's one branch, `main`.

| When | What happens | Where |
|---|---|---|
| you push to `main` | checks run, then the dev site updates | **https://point-poker-dev.fly.dev** |
| you run `npm run release` | checks run, then the live site updates and a GitHub Release is published | **https://point-poker.fly.dev** |
| you open a pull request (optional) | checks run, then a preview site is created | `https://point-poker-pr-<number>.fly.dev` |

Production saves its tables to a small disk, so a release only causes a few seconds of
"reconnecting…" and everyone lands back where they were. The dev site and previews don't
save tables: they're wiped whenever those sites redeploy or go to sleep.

## Day to day

```sh
git pull
# ...make changes...
npm run check            # typecheck + tests + build
git commit -am "Describe the change"
git push                 # -> dev site updates in about a minute
```

For a bigger or riskier change, use a branch and open a pull request instead. It gets its own
preview site, linked in a PR comment, which redeploys on every push and is deleted when the PR
closes. Previews have no Jira, so type tickets in by hand.

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
