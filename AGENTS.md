# AGENTS.md — conventions for Codex

This repo is **WYLD**: a Three.js browser game (`game/`) plus its bespoke software factory, the
Expansion Pak (`factory/`). One founder, one game. Bespoke and opinionated is fine.

## Stack

- **Node 22** (pinned in `.node-version`), **pnpm** workspaces (pinned via `packageManager` in root `package.json`).
- **TypeScript, strict, ESM everywhere.** No CommonJS, no `require`.
- Server: **Hono** on `@hono/node-server`, **SQLite** via **Drizzle** + `better-sqlite3`.
- Pak (later): **Vite + React**. Game (later): **Vite + TypeScript + Three.js**.
- Tests: **Vitest**. Lint: **ESLint** flat config + typescript-eslint. Format: **Prettier**.

## Setup

```bash
./scripts/bootstrap.sh   # corepack enable, pnpm install --frozen-lockfile, create .factory/ dirs
```

Everything must work from a clean `git clone` on a fresh machine. **Never** `npm i -g` or assume a
globally installed tool. All tool config lives in the repo.

## Commands

| Command | What it does |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` across all workspaces |
| `pnpm lint` | ESLint across all workspaces |
| `pnpm test` | Vitest across all workspaces |
| `pnpm build` | Build all workspaces |
| `pnpm --filter @wyld/server dev` | Run the Pak server with watch |
| `pnpm --filter game build` | Build the game (once `game/` exists) |

All four of `typecheck`, `lint`, `test`, `build` must pass before a PR is ready.

## Conventions

- **ESM only.** `"type": "module"`, `.js` extensions in relative imports when `moduleResolution` requires it.
- **No default exports** from modules. Named exports only.
- **Tests live alongside code**: `foo.ts` → `foo.test.ts` in the same directory.
- **Small PRs.** One coherent unit of work per PR, matching one issue.
- **No new dependencies** without stating the dependency and the reason in the PR description.
  Prefer the standard library and what is already in the lockfile.
- Validate at boundaries with **zod** schemas from `factory/shared`; do not hand-roll parsing.
- Structured JSON logging to stdout in services. No `console.log` debugging left behind.
- Workspace packages are named `@wyld/<dir>` (e.g. `@wyld/shared`, `@wyld/server`).
- Commit the `pnpm-lock.yaml` whenever dependencies change.

## Never

- **Never touch `factory/planner/`.** That directory is owned by the Planner.
- **Never commit `.factory/`** or anything under it — it is runtime output (SQLite db, logs, env,
  worktrees) and is gitignored. Never commit secrets, tokens, or `.env` files.
- Never force-push `main`. Never edit CI to make a failing check pass.

## Publishing your work

**Publish your own work.** When `GH_TOKEN` is non-empty, push your branch and open the PR yourself
— do not wait for the Planner to do it for you. This is the normal case for every task started by
the Planner via `codex cloud exec`.

A `GH_TOKEN` **environment variable** (fine-grained PAT scoped to this repo: Contents + Pull requests
read/write) is provided. It must be an environment variable, not a Codex *secret*: secrets are
removed before the agent phase starts, so a secret shows up as empty here.

The sandbox may or may not already have an `origin` remote, and if it does, that remote is
**unauthenticated** — pushing to it fails with `Invalid username or token`. So always overwrite the
remote URL with the token-bearing one. Do not use `git remote add`; it is a no-op when `origin`
already exists.

```bash
# 0. Fail fast and loudly if the token is not actually present.
if [ -z "${GH_TOKEN:-}" ]; then
  echo "FATAL: GH_TOKEN is empty or unset — cannot publish." >&2
  exit 1
fi
echo "GH_TOKEN is present (${#GH_TOKEN} chars)"   # never print the token itself

# 1. Branch.
git checkout -b codex/<short-slug>        # skip if you are already on a codex/* branch

# 2. Point origin at the authenticated URL (set-url if it exists, add if it does not).
git remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/drufball/wyld.git" \
  || git remote add origin "https://x-access-token:${GH_TOKEN}@github.com/drufball/wyld.git"

# 3. Push and open the PR.
git push -u origin HEAD
gh pr create --base main --title "<title>" --body "<PR description in the format below>"
```

- One PR per issue. Put `Closes #<issue>` in the PR body.
- When addressing review comments on an existing PR, commit and `git push` to the same branch;
  do not open a second PR.
- If `gh` is unavailable or unauthenticated, create the PR with the API instead:
  ```bash
  curl -sS -X POST -H "Authorization: Bearer $GH_TOKEN" \
    https://api.github.com/repos/drufball/wyld/pulls \
    -d '{"title":"...","head":"codex/<short-slug>","base":"main","body":"..."}'
  ```
- Never print, echo, or commit the token value. Only its length, as above.
- If the push still fails, report in your final summary: whether `GH_TOKEN` was present and its
  length, the exact command, and the exact error output. Never claim a PR exists that you did not
  verify with `gh pr view` or an API response.

## PR description format

```
## What
One or two sentences describing the change.

## Why
The problem this solves; link the issue.

## How verified
The exact commands run and their result (pnpm typecheck / lint / test / build).

<!-- quest:<id> -->
```

Copy the `quest:` marker line from the issue body verbatim if one is present; omit it if not.
