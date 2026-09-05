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

## Publishing your work (required)

The sandbox has no git remote and no GitHub auth by default. A `GH_TOKEN` secret (scoped to this
repo: Contents + Pull requests read/write) is provided in the environment. Use it to publish:

```bash
git checkout -b codex/<short-slug>        # skip if you are already on a codex/* branch
git remote get-url origin >/dev/null 2>&1 || \
  git remote add origin "https://x-access-token:${GH_TOKEN}@github.com/drufball/wyld.git"
git push -u origin HEAD
gh pr create --base main --title "<title>" --body "<PR description in the format below>"
```

- One PR per issue. Put `Closes #<issue>` in the PR body.
- When addressing review comments on an existing PR, commit and `git push` to the same branch;
  do not open a second PR.
- If `gh` is unavailable, create the PR with `curl -X POST -H "Authorization: Bearer $GH_TOKEN"
  https://api.github.com/repos/drufball/wyld/pulls` and a JSON body of `{title, head, base, body}`.
- If `GH_TOKEN` is missing or the push fails, say so explicitly in your final summary. Never
  claim a PR exists that you did not verify with `gh pr view` or the API response.

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
