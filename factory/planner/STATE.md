# Planner state — read this first on every new session

_Last updated 2026-09-05 by the 1.3 project lead. Quests in the Pak now carry the live state; this
file is down to environment facts and open items. Keep it short; update it whenever a step finishes._

## Where we are

| Step | Status | Landed as |
|---|---|---|
| Phase 0 bootstrap | done | #4 skeleton+CI, #7 shared types, #9 server v0 |
| 1.1 Pak shell + Today | done | #13 next-action + static hosting, #15 shell/theme, #20 Today + SSE + Playwright smoke |
| 1.2 Wake | done | #14 core, #18 channel adapter + `pak_log_event`/`pak_set_next_action`, #21 factory up/down/doctor |
| 1.3 Worlds/Quests, PROTOCOL v1, `pak.*` tools, since-you-looked | done | #23 server worlds/quests/links/notes, #26 nine `pak_*` tools, #27 Worlds screen + Nudge/Park/Ask |
| 1.4 Catch-Up + VMU: presence tracking, write-catchup skill, mechanical fallback | **in progress** (lead spawned 2026-09-05) | — |
| 1.5 – 1.11 | not started | see factory-spec.md §11; they exist as `idea` quests in the Pak world |

## How to work (summary; PROTOCOL.md is authoritative)

- You are the Planner: plan, file issues, review, merge. You do not write app code — Codex does.
- One **project lead subagent per step** (opus). It files issues, runs `codex cloud exec --env
  6a9be268ad288191b44bbdefcbe977ee --branch ...`, reviews the PR, drives fix rounds on the PR
  branch, squash-merges when green. When the step is done, the lead is done.
- Leads must **run** what Codex ships (browser for UI, curl/scripts for services). Codex's
  self-reported checks have been wrong repeatedly; CI is the truth, and CI does not run on a
  PR with merge conflicts ("no checks" = rebase, don't wait).
- Avoid two leads editing the same package at once (lockfile conflicts). Sequence, or split by package.
- Founder decisions (Rumbles) are rare: accounts, money, logins, taste, scope. Otherwise decide,
  build, show working code.

## Environment facts

- Codex environment **ID** `6a9be268ad288191b44bbdefcbe977ee` (label `drufball/wyld` resolves to
  a different, token-less environment — never use the label). `GH_TOKEN` there is a fine-grained
  PAT that **expires around 2026-10-05**; rotating it is a Rumble (account action by Dru).
- `@codex` mentions on GitHub are never used (env-less runs cannot push).
- Planner launch: `pnpm factory:up` → tmux session `wyld`, planner window runs
  `claude --dangerously-load-development-channels server:wake` (the spec's `--channels wake`
  does not work in the research preview; see reference/channels.md). First run needs the
  "Use this MCP server" confirmation for `wake`.
- No branch protection (Free plan, private repo) — Dru chose convention: only the Planner merges,
  only green.
- TypeScript pinned 6.0.3 (typescript-eslint peer range). Tailscale is logged out on the laptop
  (needed at 1.11 → Rumble then).

## First actions for the on-duty Planner (tmux session)

1. Confirm Wake delivery: ask Dru to type an intent on Today; you should receive a channel
   notification. If not, use `pak_read_events` to pull it and note the upstream bug.
2. Handle it per PROTOCOL.md (quest or clarifying note + next action).
3. Spawn the step 1.4 project lead (opus) with the same brief style the previous leads got:
   read STATE/PROTOCOL/spec sections, implementer loop, "run what Codex ships", exit criteria,
   screenshots, report under 400 words. Mark 1.4 in progress here.
4. Keep this file and the Pak quests in sync as steps finish.

## Open items

- Quest `pak-polish` (Dru intent 2026-09-05): mark-done button, collapsed done section on Worlds,
  wrapping Today textarea. Issue #28, one Codex task in flight; Planner reviews and merges this one
  directly. The 1.4 lead must not touch `factory/pak` until it merges (told so in its brief).
  Catch-up referencing recently-done quests is folded into the 1.4 lead's brief.

- Pak theme is a clean baseline, not yet the chunky bevelled console look — planned for 1.11
  unless Dru asks sooner.
- Pak `LiveEventsProvider` still keeps `lastEvent` in provider state (needless re-render per event).
  1.3 consumes events via `subscribe(kind, …)` and never reads `lastEvent` — it can be deleted.
- `factory/pak/src/words.ts` exports `sentenceCount`, which has no call sites. Dead on arrival in #27.
- Quest lists are ordered by quest id, so `done` and `idea` quests interleave. Fine for now; revisit
  if a world gets busy.
- Service-worker registration errored in the sandboxed in-app browser; unconfirmed on a real phone.
- Upstream channel bugs: notifications may not reach an idle session (anthropics/claude-code
  #36827, #45563, #61797). If nothing arrives after an intent, suspect that first.

## Seeded data (2026-09-05)

The Pak's SQLite (`.factory/pak.sqlite`) is seeded with the real plan, via the API, not code:

- World `pak` "Expansion Pak" (`factory`, order 0) — quests for steps 0–1.3 in `done`, and one
  `idea` quest per remaining step 1.4–1.11, each with a one-line friend-pitch.
- World `fieldwork` "Fieldwork" (`game`, order 1) — no quests yet; the game spec becomes its
  quests in Phase 2.
- Next action: "Type what we should make next" → `/`.

`.factory/` is gitignored, so a fresh clone starts empty. Re-seed with `POST /api/worlds` and
`POST /api/quests` if the database is ever rebuilt.
