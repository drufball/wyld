# Planner state — read this first on every new session

_Last updated 2026-09-05 ~21:20 by the Planner, just before respawning itself. Quests in the Pak carry the live
state; this file is down to environment facts and open items. Keep it short; update it whenever a
step finishes._

## Where we are

| Step | Status | Landed as |
|---|---|---|
| Phase 0 bootstrap | done | #4 skeleton+CI, #7 shared types, #9 server v0 |
| 1.1 Pak shell + Today | done | #13 next-action + static hosting, #15 shell/theme, #20 Today + SSE + Playwright smoke |
| 1.2 Wake | done | #14 core, #18 channel adapter + `pak_log_event`/`pak_set_next_action`, #21 factory up/down/doctor |
| 1.3 Worlds/Quests, PROTOCOL v1, `pak.*` tools, since-you-looked | done | #23 server worlds/quests/links/notes, #26 nine `pak_*` tools, #27 Worlds screen + Nudge/Park/Ask |
| 1.4 Catch-Up + VMU: presence tracking, write-catchup skill, mechanical fallback | done | #33 catchups table + `GET/POST /api/catchup` + mechanical digest, #37 `pak_write_catchup`/`pak_read_catchup`, #38 Catch-Up card + arrival gate + VMU; `skills/write-catchup.md` |
| 1.5 GitHub loop + Debug Menu health tiles | done | #41 `health` table + `POST /api/health/report` + `GET /api/health/snapshot`, #44 `pak_health_report`/`pak_read_health` + Wake `lastGithubEventAt`, #45 e2e harness isolation, #47 `/debug` live tiles |
| Quests `question-chains` + `today-glance` (Dru intents 2026-09-05, outside the step plan) | done | #49 server chains, #53 Wake `human.question`/`human.chain_closed` + `pak_read_chains`/`pak_answer_chain`/`pak_close_chain`, #54 Today chain cards, #57 quest Ask → chains, #59 in-flight quest cards on Today |
| `debug-menu` follow-up (feed the empty gauges with real reporters, plain-English tile labels) | done | #62 `POST /api/ops/report` + `ops_reports` (measured health kept apart from the Planner heartbeat), #67 `@wyld/ops` reporter (gh runs/PRs/rate + Claude session JSONL tokens, every 2 min, `ops` tmux window via `factory:up`), #68 ten plain-English tiles + stuck-channel tell, #73 no-checks-yet reads pending. `Spent today` is honestly "Not measured" (flat subscription, no cost source) |
| 1.6 Rumble screen + `pak_request_rumble`, §10 seeded as Rumble cards | done | #63 `rumbles` table + `GET/POST /api/rumbles` + `/decide` → `human.decision` + catch-up slot, #71 Wake `pak_request_rumble`/`pak_read_rumbles` (decisions never coalesce), #77 `/rumble` screen + Today "N Rumbles" link + VMU count. Seeded: 14 decided cards (§10 table + the three account jobs already done) and 4 open: Tailscale login (blocks `polish`), ntfy on the phone (blocks `paused`), renew the builder `GH_TOKEN` before ~2026-10-05, GitHub Pro vs public repo for branch protection. **Decided 2026-09-05 ~21:25:** Tailscale login → Done (laptop `macbook-pro-6.taild72c8d.ts.net`, phone on the tailnet); branch protection → "Leave it as my discipline". New open card `tailscale-serve`: Serve is not enabled on the tailnet (`tailscale serve` prints an enable link; only Dru can flip it) — blocks the Pak's HTTPS address and the ntfy card |
| `one-box` (Dru 2026-09-05 19:45: Today box has one state; Planner replies as a chain message or by creating quests) | done | #70 `POST /api/chains` with `author` + Wake `pak_send_message` (no new event kind), #75 one "What's on your mind?" box, every submission opens a chain; PROTOCOL §2/§5a + plan-quest rewritten (1fcf0e7). "Make this a quest" still emits `human.intent` from that explicit tap only |
| 1.7 – 1.11 | not started | see factory-spec.md §11; they exist as `idea` quests in the Pak world |

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

_Rewritten 2026-09-05 ~21:20 by the outgoing session, which respawned itself (no leads were running)
to load `pak_send_message`, `pak_request_rumble` and `pak_read_rumbles`._

1. Load the wake tools (ToolSearch `select:mcp__wake__pak_*`) — confirm the three new ones are
   visible. `pak_read_chains`, answer any open chain (PROTOCOL §5a: one message in, two ways out),
   then `pak_health_report`.
2. The channel queue will replay a short backlog — all already handled; a `human.decision`
   labelled "LEAD CHECK (not Dru)" is a lead's test, ignore it.
3. `pak_read_rumbles`: four real cards are open (see the 1.6 row). Nothing to do until Dru decides;
   a `human.decision` event carries the choice — record it and unpark what it unblocks (§2).
4. Spawn the **1.7 Demo Discs** lead (factory-spec §11: PR-head worktree builds, `/play/*`, in-Pak
   iframe, feedback button; `human.feedback` already exists in `EVENT_KINDS`). One lead. Also give
   it, or a small sequenced lead, the doctor check for the six tmux windows (Open items).
5. Use `pak_send_message` for heads-ups Dru can reply to; `pak_post_note` only for the quest card's
   own line. Keep this file and the Pak quests in sync as steps finish.

## Open items

- **Queued lead (start when the 1.7 lead is done — it shares `factory/wake` and `factory/shared`):
  `wake-hot-reload`.** Dru asked (2026-09-05 21:20) to stop the Planner getting stuck on the
  startup prompt when he's away. The prompt is Claude Code's development-channels warning (not
  the `.mcp.json` approval, which `.claude/settings.local.json` already grants); the auto-mode
  classifier refused to let the Planner script a keypress through it, so quest
  `unattended-restart` is **parked** until Dru allows a launcher script in his Claude settings and
  says so. The half we can do alone: make restarts rare. Codex unit: (a) `WakeMessage.kind` becomes
  a plain string at the queue boundary and unparseable messages are dropped, not retried forever
  (the frozen-channel bug below); (b) the channel adapter advertises new `pak_*` tools via MCP
  `notifications/tools/list_changed` after a `@wyld/shared`/wake rebuild, verified empirically
  against the running Planner — if Claude Code ignores it, say so in STATE.md and stop there.
  Also check in `.claude/settings.json` with `enabledMcpjsonServers: ["wake"]` so a fresh clone
  never hits the MCP approval.
- **Tailscale Serve is on (2026-09-05 ~21:30):** Dru enabled Serve on the tailnet; `tailscale serve
  --bg 8787` now proxies `https://macbook-pro-6.taild72c8d.ts.net/` → `127.0.0.1:8787` (tailnet
  only, persists across restarts; `tailscale serve status` to check, `tailscale serve --https=443
  off` to stop). Verified: `/` returns 200 with the Pak title and `/api/health/snapshot` answers.
  The 1.11 "Tailscale Serve" item is therefore done by hand; 1.11 should make `factory:up`/doctor
  check it rather than set it up. ntfy (1.8) still needs its own address on that host — pick a path
  under Serve (`tailscale serve --bg --set-path /ntfy <port>`) rather than a second hostname.
  macOS has no `timeout`; the Serve command blocks while Serve is disabled on the tailnet.

- **Rumbles API facts (1.6):** rumble ids are stable slugs, so re-filing one updates it in place;
  filing with `chosen` records a past decision **without** an event, while `/decide` always emits
  `human.decision` — never seed history through `/decide`. There is no delete endpoint; a test card
  has to be removed with sqlite3.

- **`gh pr review --request-changes` fails on Codex PRs** ("Can not request changes on your own pull
  request" — Codex pushes as drufball). Use `gh pr comment` for the record, then
  `codex cloud exec --branch codex/<slug>`. PROTOCOL/skills still say `--request-changes`; fix when
  next touched.
- **tmux windows `wyld:0` (server) and `wyld:1` (wake) vanished mid-session 2026-09-05 ~20:19** —
  gone, not crashed-and-restarted. The debug-menu lead recreated them
  (`set -a; . .factory/env; tmux new-window -t wyld:0 ...`). Cause unknown; possibly a lead's
  `respawn-window`/`kill-window` against the wrong index. A doctor check that all six windows exist
  is a cheap Codex unit. Leads: never `kill-window`; `respawn-window -k` only on the server window.
- **Scratch servers need `FACTORY_DIR=<tmp>`** — `PAK_DB` is not a thing, and `PAK_PORT` alone still
  opens the live `.factory/pak.sqlite`. `playwright.config.ts` owns port 8799; never park a
  verification server there.
- Leads picking scratch ports collided (8791/8792/8796 all taken at once). Pick a free port
  programmatically in verification runs.

- Quest `pak-polish` is **done** (2026-09-05): #28 mark-done + collapsed Done section + Today
  textarea, #29 Ask-box textarea, #30 flat Quests tab (world tags, world+status chips, `/worlds`
  redirects; `WorldQuests.tsx` renamed to `Quests.tsx`). Small leftovers folded into the 1.11
  theme pass: filter chips are 37px tall vs the 44px touch-target convention, and new `theme.css`
  rules use raw `rem` instead of `--pak-space-*` tokens. Reminder proven twice there: a Codex
  branch cut from stale main can silently drop newer `App.tsx` wiring — always check the base.

- Pak theme is a clean baseline, not yet the chunky bevelled console look — planned for 1.11
  unless Dru asks sooner.
- Pak `LiveEventsProvider` still keeps `lastEvent` in provider state (needless re-render per event).
  1.3 consumes events via `subscribe(kind, …)` and never reads `lastEvent` — it can be deleted.
- Quest lists are ordered by quest id, so `done` and `idea` quests interleave. Fine for now; revisit
  if a world gets busy.
- Service-worker registration errored in the sandboxed in-app browser; unconfirmed on a real phone.
- Upstream channel bugs: notifications may not reach an idle session (anthropics/claude-code
  #36827, #45563, #61797). If nothing arrives after an intent, suspect that first.
- **Wake channel is not test-isolated** (seen 2026-09-05): a lead's local verification stack ran a
  wake adapter, which forwarded its test events to the live Planner channel labeled as human
  intents ("Dru: first line second line" was a lead testing the textarea, absent from the prod
  event store — cross-check `pak_read_events` before acting on a surprising intent). Interim rule,
  told to both leads: verification runs start server+UI only, scratch DB, explicit PAK_PORT, never
  a wake process. Root cause (found after a second leak — 25 fake "later N" intents from an e2e
  run): the server pushes events to `WAKE_URL` whenever that env var is set, and test servers
  inherit it from a shell that sourced `.factory/env`. Rule: any non-production server or e2e run
  must have `WAKE_URL` unset (it's optional in server config). The tell remains: a surprising
  human intent that is absent from `pak_read_events` is a leaked test event. The e2e half of this
  is fixed (next item); the rule still holds for any ad-hoc local server. Proper fix (wake ingress
  rejects or namespaces non-production senders) is a future Codex unit.
- ~~The Pak e2e harness itself leaks~~ **fixed 2026-09-05 in #45.** `factory/server/src/config.ts`
  now treats an empty or whitespace-only `WAKE_URL`/`WAKE_SECRET` as unset (a non-empty malformed
  URL still fails startup), and `factory/pak/playwright.config.ts` sets both to `''`, moves the
  harness to port 8799, and pins `workers: 1` + `fullyParallel: false`. Verified by pointing
  `WAKE_URL` at a local sink with the factory up: the suite passed on 8799 and the sink received
  nothing. **`pnpm smoke` is now safe to run while the factory is running.** Two notes: the specs
  share one server and one SQLite file, so they must stay serial — `catchup.spec.ts` fails under
  two workers because `today.spec.ts` resets the unseen-event count; and the e2e script is called
  `smoke` (root `pnpm smoke`, and the CI job), not `test:e2e`. `smoke` runs the **built** server
  (`factory/server/dist/main.js`), so run `pnpm build` first — a stale dist in the live checkout
  fails with the old config error even though the merge is in.
- **Stale `@wyld/shared` dist crashes the live server on pull** (seen 2026-09-05): the server dev
  watcher restarts on a `git pull` of the live checkout, but does not rebuild `@wyld/shared`; a
  merge that adds a shared export (the catch-up engine) crashed it with a missing-export
  SyntaxError until `pnpm --filter @wyld/shared build` + `tmux respawn-window -k -t wyld:0`.
  Rule: rebuild shared in the live checkout right after merging anything that touches it. Proper
  fix (watcher also watches shared, or dev uses source not dist) is a future Codex unit.
- **New Wake tools need a Planner restart** (1.5): #44 added `pak_health_report` and
  `pak_read_health`, but the channel MCP server is registered when the Claude session starts, so a
  running Planner cannot see them until `wyld:planner` is respawned. Until then the Debug Menu's
  Planner tile reads `down` unless something posts `POST /api/health/report` directly. Once
  restarted, send `pak_health_report` after every batch of actions — `planner_state` plus
  `current_task` in the same plain English as a since-you-looked line, and `ci_state` /
  `codex_prs_open` when you know them.
- `github.ci_completed` arrives **twice** for pushes to `main`: `check_suite` and `workflow_run`
  both normalise to that kind, and Wake's coalescing keys on `pr`/`issue`/`quest`, which those
  events do not carry. PR-branch CI events do carry `pr` and do coalesce correctly. Harmless noise
  today (a push to `main` is informational), but a candidate cleanup — key the coalescer on
  `head_branch` when there is no PR.
- The Planner's own GitHub activity comes back as events (its issues as `github.issue_opened`, its
  review comments as `github.issue_comment` from `drufball`). Expected; PROTOCOL §2 already says to
  do nothing with your own review, but do not mistake a self-authored comment for Dru.
- **A new event kind silently freezes the whole channel until the Planner restarts** (found
  2026-09-05 by the question-chains lead, and it is biting right now). The channel adapter
  (`factory/wake/dist/channel-main.js`) is an MCP child of the Planner's Claude session, so it holds
  the `@wyld/shared` it loaded at session start. `parseClaimResponse` validates every claimed
  message with `WakeMessage`, whose `kind` is a `z.enum`. The first message carrying a kind the old
  enum has never heard of makes `claim()` throw, the delivery loop backs off and retries the same
  batch forever, and **nothing behind it is ever delivered** — GitHub events included. The tell:
  `GET :8788/health` shows a climbing `queueDepth` with a `lastDeliveryAt` frozen a minute before
  `oldestPendingTs`, and the oldest pending message uses the new kind. Rebuilding
  `@wyld/shared` does not fix it; only respawning `wyld:planner` (which restarts the MCP child)
  does. **Rule: after merging anything that adds an `EVENT_KINDS` entry, respawn the Planner window
  — same reflex as rebuilding shared for the server.** Proper fix (make `WakeMessage.kind` a plain
  string at the queue boundary, or drop unparseable messages instead of throwing the batch) is a
  future Codex unit; it should also cover `pak_read_events`' kind filter.

## Seeded data (2026-09-05)

The Pak's SQLite (`.factory/pak.sqlite`) is seeded with the real plan, via the API, not code:

- World `pak` "Expansion Pak" (`factory`, order 0) — quests for steps 0–1.3 in `done`, and one
  `idea` quest per remaining step 1.4–1.11, each with a one-line friend-pitch.
- World `fieldwork` "Fieldwork" (`game`, order 1) — no quests yet; the game spec becomes its
  quests in Phase 2.
- Next action: "Type what we should make next" → `/`.

`.factory/` is gitignored, so a fresh clone starts empty. Re-seed with `POST /api/worlds` and
`POST /api/quests` if the database is ever rebuilt.
