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
| 1.7 Demo Discs: `game/` scaffold, worktree builder, `/play/*`, in-Pak player + feedback | done | #80 doctor fails on a missing tmux window (with the exact `tmux new-window` to recreate it), #81 `game/` = `@wyld/game` (Vite+Three.js, `three` + `@types/three` the only new deps; one low-poly creature, `GAME_BASE` sets Vite `base`, `window.__wyld.getState()`/`screenshot()` with `preserveDrawingBuffer`), #85 `demos`/`feedback` tables + `createDemoBuilder` (fetch → worktree → `pnpm install` → `GAME_BASE=/play/<slug>/ pnpm --filter @wyld/game build` → atomic publish) + `GET/POST /api/demos`, `POST /api/demos/build`, `GET/POST /api/feedback`, `GET /api/feedback/:id/screenshot`, `/play/<slug>/*` via `resolveStaticFile`, #84 Wake `pak_register_demo`/`pak_read_demos`/`pak_read_feedback`, #87 `/demos` grid + `/demos/:id` full-screen iframe player + floating feedback + Today/VMU "N demos ready". `/play/main/` is live and registered. **The Planner must respawn to see the three new tools.** |
| `wake-hot-reload` (half of quest `unattended-restart`; Dru 2026-09-05 21:20) | done | #90 tolerant claim path (`WakeMessageWire`, per-message drop + ack, `/queue/claim` retires unserialisable rows, `pak_read_events`/`pak_log_event` unfrozen, `.claude/settings.json` checked in), #93 tool hot reload (swappable registry + `reload.ts`: `fs.watch` on `dist/` and `SIGHUP`, `notifications/tools/list_changed`). Claude Code **does** honour `list_changed` — verified live. The quest stays `parked`: the launch-warning keypress still needs Dru |
| `pak-theme` unit 1 (Dru 2026-09-05 21:43: "Dracula console look") | done | #89 / PR #91 — Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js`, CSS-first `@theme`), Dracula tokens + shadcn token names in `theme.css`, shadcn primitives hand-copied into `factory/pak/src/components/ui/` (`button`/`card`/`badge`/`input`/`textarea`) + `src/lib/utils.ts` `cn()`, `Panel` reimplemented over `Card variant="bevel"` (`Panel.css` deleted), app shell + `Nav` + `Today` + `ChainList` + `InFlight` migrated, body in the system mono stack and the pixel font on headings/badges/labels only. Two fix rounds. Unit 3 is written and ready to file: `factory/planner/queued/pak-theme-unit-3.md` |
| `pak-theme` unit 2 | done | #94 / PR #95 — Quests, Rumble and Catch-Up migrated onto the unit-1 primitives; `Card` gained `asChild` (radix `Slot`) so a `Card` can render the `article` that carries the `quest-card` / `rumble-card` test hooks; filter chips are now ≥44px `Button`s (last `pak-polish` leftover closed); `theme.css` lost 426 lines (all `.quest-*`, `.rumble-*`, `.catch-up*`, `.world-*`, `.ask-composer*`, `.today-action`) with **zero** added. No fix rounds — merged on the first review. |
| `pak-theme` unit 3 | done | #97 / PR #100 — VMU, Debug, Demo Discs grid + player chrome onto the primitives; `Panel` deleted (call sites use `Card variant="bevel" className="p-5"`); `lastEvent` removed from `LiveEvents` (nothing read it); **`theme.css` is now tokens + `@layer base` + two keyframes + the reduced-motion guard and nothing else** — zero class rules. One fix round (two deleted rules whose job had not moved onto the element, see Open items). Quest → `demo`. |
| 1.8 Paused (quest `paused`) | done (2026-09-06 08:47, six PRs, two fix rounds) | #98 `notify()` + `POST /api/notify` + Wake `pak_notify` (no-op when `NTFY_URL` unset); #101 persisted per-lane pause (`pauses` table, idempotent `POST /api/pause`, `POST /api/resume`, `system.paused`/`system.resumed`, outage Rumble whose Resume resumes server-side, `paused` on the health snapshot, absolute `click` from `PAK_PUBLIC_URL`, one retry on the push); #105 `@wyld/ops` quota watchdog (gh rate-limit → pauses lane `github`, missing Planner heartbeat > 15 min → lane `planner`, headroom → resume); #107 Pak calm banner + Resume + VMU row; #109 ntfy container (`binwiederhier/ntfy:v2.28.0`, container `wyld-ntfy`, `--restart unless-stopped`, 127.0.0.1:8790, config `factory/ntfy/server.yml`, cache `.factory/ntfy/`, `tailscale serve --bg --https=8443 8790` → `https://macbook-pro-6.taild72c8d.ts.net:8443`, topic `wyld-pak`; `bootstrap.sh` now appends missing keys to `.factory/env`: `NTFY_PORT`/`NTFY_URL`/`NTFY_TOPIC`/`PAK_PUBLIC_URL`; Rancher Desktop `application.autoStart` is true); #108 Wake buffers only on an `all` pause (`syncWakePause()`; a lane pause keeps delivery running), `pak_pause`/`pak_resume`. Dru's phone is subscribed (card `ntfy-setup` Done 08:30). |
| 1.9 – 1.11 | not started | see factory-spec.md §11; they exist as `idea` quests in the Pak world |

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

_Rewritten 2026-09-06 ~23:30 by the outgoing session, which respawned itself (no leads were
running — the pak-theme lead was stopped at a clean boundary on purpose) to load
`pak_register_demo`, `pak_read_demos`, `pak_read_feedback` and the hot-reloading wake adapter._

1. Load the wake tools (ToolSearch `select:mcp__wake__pak_*`) — confirm the three demo tools are
   visible. `pak_read_chains`; answer any open chain (PROTOCOL §5a). `pak_health_report`. Chain
   "restart-proofing half is in" (on `unattended-restart`) is the Planner's own heads-up about
   this restart — close it once you are up.
2. The channel queue replays a short backlog — all handled. Everything up to `f85baab` is done.
3. Open Rumbles: `ntfy-phone` (waits on 1.8's ntfy server + a path under Tailscale Serve) and
   `rotate-build-token` (before ~2026-10-05). Both wait on Dru or on later steps.
4. ~~Spawn the `pak-theme` lead for units 2 and 3.~~ **Done 2026-09-06 ~08:06.** PR #95 (unit 2,
   no fix rounds) and PR #100 (unit 3, one fix round) are merged, deployed to the live Pak and the
   main disc rebuilt; the quest is in `demo`. `factory/pak` is free for the next lead, and the three
   spent issue bodies in `factory/planner/queued/` can be deleted.
5. ~~`paused` unit C~~ **`paused` is done (08:47).** `improved-chains` lead **spawned 08:49** — its server and pak units run now; its wake unit waits until `planner-in-pak` unit 1 (#110) merges, because that lead owns `factory/wake` meanwhile.
   It touches server + wake + pak, so it runs alone.
6. From now on, after a merge that adds a `pak_*` tool, `pnpm --filter @wyld/wake build` in the
   live checkout is enough — the adapter reloads and the tool appears next turn. **Confirmed under
   the channels flag 2026-09-06 07:47:** `pak_notify` (merged in #98) appeared in the live Planner
   session as a deferred tool without a restart. A schema that
   lives in `@wyld/shared` still needs a Planner restart to change shape.
7. Restarting the Planner still needs Dru's keypress at the channels warning (quest
   `unattended-restart` is parked on that). Restart only at a clean boundary, tell him first via
   `pak_send_message`, and prefer doing it while he is around.

## Cutover to the host (runbook — written 2026-09-06 09:25, execute once #116 has merged)

The last attended restart. Everything below is the Planner's own job; leads never do it.

**Preconditions, all true before starting**
1. `planner-in-pak` unit 2 (#116) merged and deployed: `git pull`, `pnpm --filter @wyld/planner-host build`,
   `scripts/factory-up.sh` has `PLANNER_MODE` (`host` default, `cli` fallback), doctor checks `:8789/health` and
   "exactly one Planner".
2. **No lead mid-flight.** Leads are subagents of the CLI session and die with it. Wait for every running lead to
   report (or reach a merge boundary), and check `gh pr list` / `gh issue list` for Codex tasks still open — the
   new session inherits those from GitHub, not from memory, so list them in "First actions" below.
3. `pnpm factory:doctor` green; `.factory/env` has `CLAUDE_CODE_OAUTH_TOKEN` (it does, since 08:27); no
   `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` in that file or the tmux environment (sharp edge 5 above).
4. No open chain; next action set; `pak_health_report` sent.

**Steps**
1. `pak_send_message` (no quest): one paragraph — switching to the new home now, a few quiet minutes, no
   keypress needed this time, and how he'll know it worked (Debug Menu Planner tile alive, "hello" note on
   `planner-in-pak`).
2. Rewrite "First actions for the on-duty Planner" below for the new session: it will be a **fresh** session
   (no `.factory/planner-session.json` yet), so it must read this file, load the wake tools, answer chains,
   re-adopt any open Codex PRs/issues by quest, and post the hello note. Commit and push.
3. From this session, replace the planner window in place (this kills the CLI Planner — expected):
   `tmux respawn-window -k -t wyld:planner -c /Users/drufball/code/wyld 'set -a; . .factory/env; set +a; PLANNER_MODE=host exec <the exact command factory-up.sh uses after #116>'`
   — copy the command verbatim from `scripts/factory-up.sh` at cutover time; do not improvise it.
4. The new session verifies itself: `curl -s localhost:8789/health` shows a session id; `pak_health_report`
   lands; the Debug Menu's Planner tile reads alive. If nothing happens within 5 minutes, Dru's fallback is
   `tmux respawn-window -k -t wyld:planner 'claude --dangerously-load-development-channels server:wake'`
   (the CLI path, one keypress) — put that sentence in the message to him.

**After cutover (new session's job):** move `planner-in-pak` → `demo` with a note; close `unattended-restart`
as done ("restarts no longer need you"); update PROTOCOL.md §6 "Known constraints" and `reference/channels.md`
to say the channel flag is the fallback path only; delete `factory/planner/queued/*` (spent).

## Open items

- **Never post to the live `/api/notify` (or call `pak_notify`) from a verification run** (2026-09-06: a lead's
  last smoke check sent a junk "x / y" push to Dru's phone). Scratch servers must leave `NTFY_URL` unset; the
  live notifier is for a pause, a new Rumble, or a demo ready — nothing else. Lead briefs must say so.

- **Quest `planner-in-pak` "Planner inside the Pak" — DECIDED 2026-09-06 08:14: "Move the Planner into the Pak". Lead spawned 08:16 (units 1 host + 2 launcher; it waits for #102 to merge before touching `factory/wake`). Rumble `planner-token` is **Done (08:27)**: Dru pasted the `claude setup-token` token into a chain and asked the Planner to install it; the Planner appended `CLAUDE_CODE_OAUTH_TOKEN=` to `.factory/env` (mode 600) at his explicit request — the only sanctioned exception to POLICIES "never touch `.factory/env`" — and redacted the token from `chain_messages`/`events` in `.factory/pak.sqlite` with sqlite3. The host inherits it via `set -a; . .factory/env`. `unattended-restart` stays parked as superseded; close it when the host ships. The cutover (stop the CLI Planner, start the host) is the Planner's own job, announced to Dru first — it is the last attended restart. History of the decision (2026-09-06 08:15, corrected):** Dru asked whether to move the Planner into the Pak via the Claude Agent SDK. **First answer was
  wrong** (a guide subagent over-read the developer clause; the Planner relayed it without reading the source —
  Dru caught it). Verified facts, read directly: (a) support.claude.com article 15036540 "Use the Claude Agent
  SDK with your Claude plan" (2026-06-16): "Claude Agent SDK, `claude -p`, and third-party app usage still draw
  from your subscription's usage limits"; (b) code.claude.com/docs/en/legal-and-compliance: "Advertised usage
  limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK" — the
  prohibition is on *developers offering claude.ai login to their users*, not on an individual's own tool;
  (c) code.claude.com/docs/en/authentication: the SDK wraps the CLI and uses the same credential precedence —
  `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` (one-year, "authenticates with your Claude subscription",
  model requests only, local MCP still works; not read in `--bare` mode) or the machine's `/login`.
  (d) The SDK has **no channels** (CLI-only research preview) but **streaming input** (`streamInput()` on a
  long-lived `query()`, each yielded user message = a turn) replaces the push; MCP servers, subagents, skills,
  hooks, permission modes, CLAUDE.md via `settingSources`, session resume all carry over. (e)
  `--dangerously-load-development-channels` prompts even non-interactively; no bypass. **Recommendation now:
  move.** Rumble options: move (recommended) / launcher by Dru / restarts wait. On `human.decision` = move:
  unpark → `planning`; units: (1) `factory/planner-host` (Node, `@anthropic-ai/claude-agent-sdk`, long-lived
  session, `mcpServers.wake` stdio for `pak_*`, `settingSources: ['project']`, Wake `/queue/claim` drained into
  `streamInput` messages formatted like today's `<channel>` tags, `resume` by session id, heartbeat), (2)
  `factory-up.sh`/doctor run the host in the `planner` window with the CLI path kept as fallback for a week.
  Account job for Dru (Rumble `planner-token`, kind account): `claude setup-token` → paste into `.factory/env` as
  `CLAUDE_CODE_OAUTH_TOKEN` (bootstrap must append missing keys — see the `.factory/env` note above). Other
  options: launcher → unpark `unattended-restart`, ask for the script path; wait → note both quests and park.
  **Lesson (Planner):** never put a legal/policy claim from a subagent on a Rumble without reading the primary
  page yourself.
  - **Unit 1 landed 2026-09-06 09:21 — #110 / PR #112** (one fix round). New package
    `factory/planner-host` (`@wyld/planner-host`): one long-lived `query()` in streaming-input mode that claims
    Wake's queue itself, renders each message as a `<channel …>` tag, feeds it in as a turn, persists/resumes the
    session id and restarts itself. **Exact SDK options:** `cwd` = repo root, `model` `claude-fable-5-1`,
    `settingSources: ['project']`, `permissionMode: 'bypassPermissions'`, `allowedTools` incl. `mcp__wake__*`,
    `mcpServers.wake` = stdio `node factory/wake/dist/channel-main.js` with `WAKE_CHANNEL_PUSH=0`,
    `abortController`, `stderr` **callback**, `resume` when a session file exists. Deliberately **not** set:
    `Options.env` (it *replaces* the parent env, killing PATH and the OAuth token), `agents`, `persistSession`.
    **Env flag:** `WAKE_CHANNEL_PUSH` (`0`/`false` ⇒ the adapter serves tools + hot reload only). **Health port:**
    `PLANNER_HOST_PORT`, default **8789**, `GET /health` → `{ ok, sessionId, lastTurnAt, queueDepthSeen, restarts }`.
    Session id in `.factory/planner-session.json`. Verified live against a scratch stack: fresh start → event
    claimed *during* the bootstrap turn and correctly held → one turn per batch → `pak_answer_chain` reply →
    ack drained the queue → killing the subprocess restarted it resuming the **same** session id.
    Sharp edges found the hard way, all of which cost time or would have:
    1. **The real `<channel>` tag is NOT what `CHANNEL_INSTRUCTIONS` documents.** Ground truth (read out of the
       Planner's own transcripts, `~/.claude/projects/-Users-drufball-code-wyld/*.jsonl`): `source` appears
       **twice** — `source="wake"` added by Claude Code from the MCP server name, then the message's own
       `source="github"`/`"human"` from `meta`; the order is `source="wake"`, `kind`, `ts`, `source`, `quest`,
       `issue`, `pr`, `chain`, `url` (the `meta` insertion order of `notificationFor`); and the summary sits on
       **its own line**. If you ever re-render these, copy real tags out of a transcript rather than trusting the
       docstring.
    2. **`stderr` is a callback `(data: string) => void`, not a boolean.** Codex cast `true` into it; the SDK does
       `this.options.stderr?.(y)` from the subprocess's stderr `data` handler, so `true?.(y)` throws an uncaught
       `TypeError` that kills the host. It fires **zero** times on a healthy run (the CLI writes nothing to stderr
       when all is well), so it is invisible until the moment something goes wrong. General rule: **an
       `as unknown as` cast to satisfy a type means the value is wrong.**
    3. **A new dep version trips `minimumReleaseAge`, not `allowBuilds`.** The SDK has no install scripts anywhere
       in its 103-package tree, so no `allowBuilds:` entry was needed; what CI wanted was
       `minimumReleaseAgeExclude` entries for `@anthropic-ai/claude-agent-sdk@0.3.263` **and each of its eight
       platform optional deps**.
    4. **Without `WAKE_CHANNEL_PUSH=0` the adapter silently eats every event** — reproduced: it claims the row,
       emits a channel notification the SDK cannot receive, and acks it. The queue drains, `lastDeliveryAt`
       advances, the Pak looks healthy, and the Planner never hears a thing.
    5. **`ANTHROPIC_API_KEY` outranks `CLAUDE_CODE_OAUTH_TOKEN`** — an API key in the environment silently moves
       billing off the subscription. The host warns (never printing the value) if either it or `ANTHROPIC_AUTH_TOKEN`
       is set.
    6. **A bad `resume` id does not throw.** It yields **no `init` at all**, then one `result` with
       `is_error: true`. That is the only reliable tell. Note `system:init` arrives **once per turn**, not once per
       query, so "have I seen an init for this query" is the right check, not "exactly one".
    7. The query yields **undocumented message types** (`rate_limit_event` seen live) — never switch exhaustively.
    8. The SDK transcript lands in `~/.claude/projects/<cwd, every non-alphanumeric → '-'>/<session-id>.jsonl` with
       the same `message.usage` keys `factory/ops/src/usage.ts` sums, so **the Debug Menu's token tile keeps
       working only while `cwd` is the repo root** and `persistSession` is left alone.
- **`wake-hot-reload` is done (2026-09-05 ~23:20)** — #88/#90 (tolerant claim path) and #92/#93
  (tool hot reload). Quest `unattended-restart` stays **parked**: the half that needs Dru is
  unchanged — Claude Code's development-channels warning at launch, which the auto-mode classifier
  will not let the Planner (or a lead) script a keypress through. A lead hit the same refusal again
  on 2026-09-05 while probing, so treat it as settled: it needs Dru to allow a launcher script in
  his Claude settings and say so. What shipped instead, and what is now true, is in the two struck
  items below. `.claude/settings.json` (`{"enabledMcpjsonServers": ["wake"]}`) is now checked in, so
  a fresh clone never sees the `.mcp.json` approval prompt.
- **Quest `pak-theme` "Dracula console look" is DONE and in `demo` (2026-09-06 ~08:06).** Unit 1
  #89 / PR #91, unit 2 #94 / PR #95 (no fix rounds), unit 3 #97 / PR #100 (one fix round). Every
  Pak screen now runs on the one design system and `theme.css` holds no class rules at all. The
  three files in `factory/planner/queued/` are spent and can be deleted whenever.
  **The rule that made this cheap, worth reusing on the next migration:** the failure mode is never
  the new markup, it is a deleted CSS rule whose job did not move onto the element. Both unit-3
  regressions and both unit-1 ones were that, and none of them are caught by typecheck, lint, the
  unit tests, the Playwright suite or CI — only by looking at the built app at 375px. Diff the
  deleted selectors against `src/**/*.tsx` *and* read what each deleted rule actually did before
  accepting its replacement. Dru's ask, verbatim: "I really like
  the retro card style of debug page, and I like that it only uses game font for headings/accents.
  Redesign the home page and all the other pages to use a shared shadcn design system and make it
  look a bit more code editor Dracula theme, with retro game accents." Taste is decided — never
  re-ask. This supersedes the 1.11 "theme pass" and folds in the `pak-polish` leftovers (the filter
  chips, now 34px, and the raw `rem` rules) — unit 2 fixes both.
  - ~~**Unit 2** = Quests + Rumble + Catch-Up.~~ ~~**Unit 3** = VMU + Debug + Demo Discs +
    `theme.css` clean-up + the `lastEvent` removal.~~ **Both done.**
  - **Unit 3's two regressions (one fix round), both the deleted-rule trap:** (a) `theme.css` had
    `@media (min-width: 360px) { .pak-nav__label--mobile { display: none } .pak-nav__label--desktop
    { display: inline } }`, while `Nav.tsx` carried `md:hidden` / `hidden md:inline` underneath it.
    Deleting the rule moved the switch from 360px to Tailwind's `md` (768px), so a 375px phone
    silently started reading `TODAY QUEST DEMOS RMBL DEBUG MEM`. Fixed with `min-[360px]:hidden` /
    `hidden min-[360px]:inline`. **Lesson: a legacy rule and a Tailwind class on the same element
    can disagree about the breakpoint, and the legacy one may be the one that was winning.**
    (b) `.demo-player` was `inset: 0 0 72px 0` — the 72px was deliberate room for the fixed bottom
    nav. It became `inset-0 z-[60]`, which covered the nav on a phone and left the back button as
    the only way out. Restored to `fixed inset-x-0 top-0 bottom-[72px]` with no z-index.
    **Lesson: an inset that is not zero on one side is usually reserving space for something —
    find out what before flattening it to `inset-0`.**
  - **New from unit 2 (no fix rounds; these are what made it clean):** `Card` needed an `asChild`
    prop (`@radix-ui/react-slot`, already a dep) so a `Card` can *be* the `<article>` that carries
    the `quest-card` / `rumble-card` test hook — wrapping a `Card` around an `article` would have
    put the hook on the wrong element. Tailwind v4 accepts bare values like `duration-400`
    (confirmed in the built CSS: `.duration-400{transition-duration:.4s}`); v3's fixed duration
    scale does not apply. And the *derived* progress bar reads 0 for every quest with no
    `quest_links`, so a verification server must seed links (`POST /api/quests/<id>/links`) or the
    green fill never renders and cannot be checked. A leftover `className` whose rule was deleted
    (`quest-actions`) is harmless when Tailwind utilities do the layout — the trap is only when the
    deleted rule was doing the work.
  - **Deps are settled** (Dru's explicit ask, nothing else new): `tailwindcss` + `@tailwindcss/vite`
    (v4, dev), `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot` (prod),
    all pinned exact. `lucide-react` was allowed but deliberately not added — nothing needed an icon.
  - Sharp edges found the hard way in unit 1, all four of which cost a fix round:
    1. **pnpm 11 blocks postinstall scripts.** A new dep with a build step fails CI at
       `pnpm install --frozen-lockfile` with `ERR_PNPM_IGNORED_BUILDS`. Add it to `allowBuilds:` in
       the root `pnpm-workspace.yaml` (`'@tailwindcss/oxide': true` is now there).
    2. **`pnpm lint` lints the `.tsc` declaration output** that `pnpm typecheck` emits, and CI runs
       them in that order — a non-exported `cva` const in a `.tsx` fails lint via its `.d.ts`.
       Fixed properly: `'**/.tsc/**'` is now in `eslint.config.js`'s `ignores`.
    3. **Class names are a test contract.** The Playwright specs and `App.test.tsx` select on
       `.chain-card`, `.today-quest`, `.quest-card`, `.rumble-card`, `.demo-card`,
       `.pak-nav__label--mobile` / `--desktop`. A migration that drops them fails 4+ specs. Keep
       the class name on the migrated element alongside its Tailwind classes; never edit a spec.
    4. **A deleted CSS rule with a live `className` is silent** — nothing catches it. `.pak-dim` and
       `.today-action` were both deleted while still used, and the Catch-Up card's next action
       became plain text. Grep `src/**/*.tsx` against `theme.css` before pushing.
  - Also: `overflow-anywhere` is not a Tailwind class — v4.1's utility is `wrap-anywhere`. And
    Tailwind v4's preflight resets the whole app, including un-migrated screens, so every unit must
    look at every screen at both widths, not just the ones it touched.
  - Verified by eye at 375×812 and 1280×900 on the built Pak against a scratch server: no
    horizontal scroll anywhere, every control on the migrated screens ≥44px, the Debug Menu still
    reads as the reference (its tile labels must stay in the *body* face — a blanket
    `h1, h2 { font-family: display }` in `@layer base` broke that and had to be narrowed to `h1`).
- **Queued lead (after `wake-hot-reload`, same packages): quest `improved-chains` "Better
  chains"** (Dru, 2026-09-05 21:41, verbatim: "rumbles should also be a chain of type rumble. Can
  also be tagged with a quest at the same time. All chains should be snoozable"). Design to state
  in the issues: chains get a `kind` (`question` | `message` | `rumble`); a Rumble is stored/served
  as a chain of kind `rumble` that keeps its options, context and `chosen`, and deciding still
  emits `human.decision`; a rumble chain may carry `questId` too; every chain gets `snoozedUntil`
  — Today hides snoozed chains and they reappear at that time (a snoozed rumble still counts on
  the Rumble screen). Keep `pak_request_rumble`/`pak_read_rumbles` working; add `pak_snooze_chain`
  or fold snooze into the chain API for the UI only (the Planner never snoozes). **Added 2026-09-06 08:17 (Dru, verbatim: "on mobile the conversations get a bit long. Can we do something like reddit where all the previous messages collapse when I send a message to save room and then I can expand them if I want?"):** in a chain card with more than two exchanges, everything except the latest human message and the latest Planner answer folds into one ≥44px "N earlier messages" row that expands in place; sending a new message re-folds; UI-only, no API change, remember expanded state per chain in component state only. **Added 2026-09-06 09:05 (Dru, verbatim: "I don't really like the styling of the 'what's on your mind?' input. First, I don't like how it has no background and the text just sits on the wallpaper. But second, it takes up a lot of vertical space and kinda feels disconnected from the chains. I'm thinking maybe there's a bottom floating action button in the corner, tapping that expands an input box, I type and hit enter and then that creates a chain."):** Today loses the always-visible textarea; a floating "+" (≥56px) bottom-right above the 72px phone nav opens a composer (bottom sheet ≤md, popover on desktop) with the same placeholder and submit path; Enter sends, Shift+Enter newline, Escape/scrim closes; focus management + `aria-expanded`/`role=dialog`; Today order = next action, chains, in-flight quests. Sent to the improved-chains lead for its pak unit. Plan the split:
  server model + migration → Wake tools → Pak UI (Today cards + Rumble screen + snooze control).
  - **Unit 1 (server) is DONE — #111 / PR #113, merged and deployed 2026-09-06 09:19, one fix round.**
    `rumbles` is gone as a table: a Rumble is now a row in `chains` with `kind='rumble'`, a stable
    `slug` (the old rumble id, unique index), and flat rumble columns (`title`, `context`, `options`,
    `chosen`, `chosen_at`, `blocking_quest_ids`, `rumble_kind` — renamed so it cannot collide with
    the chain's own `kind`). Every chain also has `kind` (`question`|`message`|`rumble`, backfilled
    from the first message's author) and `snoozed_until`. Shared `Chain` gained `kind`,
    `snoozedUntil` and a nested `rumble: Rumble | null` — nesting, rather than flattening, is what
    kept `GET /api/rumbles` byte-identical. New routes: `POST /api/chains/:id/snooze {until}` and
    `/unsnooze`, neither of which emits an event (the Planner must never be woken by a snooze).
    `GET /api/chains` gained `kind` / `status` / `includeSnoozed`; **with no `kind` it excludes
    rumble chains**, which is what made this safe to deploy before the Pak unit exists.
    `listOrderedRumbleRows`, `pause.ts` and the catch-up digest all read chains now.
  - **New sharp edge — `z.input` vs `z.infer` on a schema with `.default()`.** The first cut typed
    `export type Chain = z.input<typeof Chain>`, which makes every field carrying a `.default()`
    **optional** for every downstream consumer: `chain.kind` became `… | undefined` and
    `chain.rumble` `Rumble | null | undefined`, which would have forced `?? ` noise through the Pak
    and Wake units for fields the server always sends. Typecheck, lint, tests and CI were all green
    on it — the only way to see it is to probe the built `.d.ts` from a consumer package. On a
    response schema, always `z.infer` (the parsed shape); keep the defaults for leniency and export
    a separate `…Input` type if a call site really needs the loose shape.
  - **Migration verification worth repeating:** build a scratch server from `origin/main` in one
    worktree against a throwaway `FACTORY_DIR`, seed it through the API, then start the branch's
    build against **the same `FACTORY_DIR`** and diff the two `/api/rumbles` payloads. That is what
    proved the data copy; a fresh-database test proves nothing about a migration. Verified again on
    the live box after merging: all 22 real Rumbles came back identical.
  - Cheap trap hit while doing that: background jobs do not survive between Bash calls, so `kill %1`
    in a later call is a no-op and the old server keeps the port — the new one dies with `EADDRINUSE`
    and you silently test the *old* build. Kill by port (`lsof -ti :PORT`), not by job number.
- **Tailscale Serve is on (2026-09-05 ~21:30):** Dru enabled Serve on the tailnet; `tailscale serve
  --bg 8787` now proxies `https://macbook-pro-6.taild72c8d.ts.net/` → `127.0.0.1:8787` (tailnet
  only, persists across restarts; `tailscale serve status` to check, `tailscale serve --https=443
  off` to stop). Verified: `/` returns 200 with the Pak title and `/api/health/snapshot` answers.
  The 1.11 "Tailscale Serve" item is therefore done by hand; 1.11 should make `factory:up`/doctor
  check it rather than set it up. ntfy (1.8) still needs its own address on that host — pick a path
  under Serve (`tailscale serve --bg --set-path /ntfy <port>`) rather than a second hostname.
  macOS has no `timeout`; the Serve command blocks while Serve is disabled on the tailnet.

- **ntfy's server does not run on macOS (found 2026-09-06 by the 1.8 lead, the hard way).** The official
  darwin release `ntfy_2.28.0_darwin_all.tar.gz` is **client-only**: it has `publish` and `subscribe` and no
  `serve` command at all (`ntfy serve` prints `No help topic for 'serve'`). ntfy's own install docs say it
  outright: "Only the ntfy CLI is supported on macOS. ntfy server is currently not supported." Homebrew's
  formula is the same CLI-only build. So factory-spec §10's "ntfy, self-hosted on the laptop" is not
  buildable as written, and the `tailscale serve --https=8443` plan for it is moot. The two real options,
  now on Rumble `ntfy-phone`: the free hosted ntfy.sh with an unguessable random topic (verified working
  from this laptop — publish and `?poll=1` both fine, title/tags/click all survive), or the linux/arm64
  image `binwiederhier/ntfy:v2.28.0` under the already-installed Rancher Desktop (image confirmed to exist;
  the VM would have to stay up). Useful facts either way: health is `GET /v1/health` → `{"healthy":true}`
  (not `{"ok":true}`, so doctor's `check_health` helper cannot be reused as-is); ntfy has **no sub-path
  support**, so it can never live under a path on the existing Serve; `upstream-base-url: https://ntfy.sh`
  is what makes iOS push instant for a self-hosted server and forwards only a topic hash and poll id, never
  the message text; release checksums are in `checksums.txt`, not a `SHA256SUMS` file.
- **POLICIES "Never touch `.factory/env`" beat a lead brief that allowed appending to it** (2026-09-06).
  The lead was told it could append `NTFY_URL`/`NTFY_TOPIC`; POLICIES #5 says never, so it did not, and
  `NTFY_URL` is simply unset on the live box (doctor warns, pushes are a no-op). Whoever finishes the
  transport needs a sanctioned way in: let `bootstrap.sh` append only *missing* keys to an existing
  `.factory/env`, which is the one script that already owns that file.

- **Two push-notification defects that only a live run found (1.8 lead, 2026-09-06).** Both were invisible to
  typecheck, lint, tests and CI, and both were fixed in PR #101's fix round.
  1. **A relative `click` in an ntfy push is dead.** The pause notification shipped `click: '/rumble'`; ntfy stores
     it verbatim and hands the bare path to the phone app, which has no idea what host it belongs to. Fixed with a
     `PAK_PUBLIC_URL` config key (empty = omit `click` entirely, never send a relative one) and
     `new URL('/rumble', pakPublicUrl)`. Verified against a real ntfy server: the push now carries
     `https://macbook-pro-6.taild72c8d.ts.net/rumble`.
  2. **The one push that matters had no retry, and it was observed failing.** Two consecutive pause notifications
     died with `TypeError: fetch failed` ~320ms in (a connection blip, not the 2s timeout) while a direct `fetch`
     from the same directory succeeded moments later. Fire-and-forget with a single attempt means an outage push —
     the only signal Dru gets that the factory stopped — can vanish into a log line he cannot see. `createNotifier`
     now retries once after 1s with a **fresh** `AbortSignal` (an aborted signal cannot be reused) and logs at most
     once. Lesson for anything user-visible and fire-and-forget: run it for real, repeatedly; the failure only
     showed up in a live run.

- **The push channel, as actually built (2026-09-06).** ntfy runs as a **container**, not a binary: `binwiederhier/ntfy:v2.28.0` (linux/arm64), container `wyld-ntfy`, `--restart unless-stopped`, published on **127.0.0.1:8790 only** so nothing but Tailscale can reach it. Config is checked in at `factory/ntfy/server.yml` and mounted read-only; cache lives in the mounted `.factory/ntfy/`. `scripts/ntfy-up.sh` (idempotent) and `ntfy-down.sh`; `factory:up` runs the former outside tmux (it is already a daemon, so it gets no window and doctor's `expected_windows` list is untouched), `factory:down` runs the latter. Doctor checks the runtime, the container, `/v1/health` and Serve on 8443. **Public address: `https://macbook-pro-6.taild72c8d.ts.net:8443`, topic `wyld-pak`**, via `tailscale serve --bg --https=8443 8790` (persists across restarts). Dru's phone is subscribed and confirmed 2026-09-06 08:30. Rancher Desktop's `application.autoStart` is **true**, so the runtime comes back after a reboot and the container with it. `doctor`'s `check_health` now takes the field name to assert because ntfy answers `{"healthy":true}`, not `{"ok":true}`.
- **`bootstrap.sh` may now append missing keys to an existing `.factory/env`** — it copies any `KEY=` line from `factory/env.example` that is absent, never modifies or reorders an existing line, and never touches `WAKE_SECRET`/`GH_WEBHOOK_SECRET`. This is the sanctioned way a new config key reaches the live box: POLICIES #5 forbids the Planner (or a lead) hand-editing that file, and this is the one script that owns it. That is how `NTFY_PORT`, `NTFY_URL`, `NTFY_TOPIC` and `PAK_PUBLIC_URL` got there.
- **`tmux respawn-window` does NOT pick up new `.factory/env` keys.** A window keeps the environment captured when it was created, so respawning `wyld:0` after adding a key silently restarts the server with the old env and the new feature looks broken. Set them on the session first — `tmux setenv -t wyld KEY value` for each new key — then `tmux respawn-window -k -t wyld:0`. Cost ten confused minutes; the tell is a route that still behaves as if the key were unset.
- Small leftover spotted while screenshotting the banner: Today renders **"1 Rumbles"** (raw count plus a blanket plural) where the VMU correctly says "one Rumble" via `countInWords`. Pre-existing, not from 1.8; a one-line fix for whoever is next in `factory/pak`.

- **Only a `lane: 'all'` pause may stop Wake delivering** (caught in review of PR #108, 2026-09-06). The first cut called `notifyWake(pause.since)` on *every* pause, so pausing one lane blinded the Planner entirely. That would have been live within the hour: the ops watchdog auto-pauses lane `github` on a routine rate-limit dip, which would have stopped the Planner receiving any events at all — including the ones telling it the factory was in trouble — until something else resumed it. spec §7 is explicit that a partial outage stays partial ("Codex out → Planner still reviews/merges what exists"). Fixed with one `syncWakePause()` helper called after every pause and resume transition, which recomputes whether an active `lane: 'all'` pause exists and tells Wake accordingly — one rule, two call sites that cannot drift. Verified live against a real Wake + Pak pair: pausing `github` keeps delivery running, pausing `all` stops it, resuming `github` alone stays stopped, resuming everything replays the backlog. **General lesson: when a feature is lane-scoped, check every side effect is lane-scoped too.**

- **Rumbles API facts (1.6):** rumble ids are stable slugs, so re-filing one updates it in place;
  filing with `chosen` records a past decision **without** an event, while `/decide` always emits
  `human.decision` — never seed history through `/decide`. There is no delete endpoint; a test card
  has to be removed with sqlite3.

- **Demo Disc builds (1.7) run inside the Pak server process.** `REPO_DIR` (default: the repo root)
  is fetched and worktree'd into `$FACTORY_DIR/worktrees/<slug>`, built, and published to
  `$FACTORY_DIR/demos/<slug>`; a warm pnpm store makes the whole thing ~15-20s. Rebuild main after
  any merge with `curl -XPOST localhost:8787/api/demos/build -d '{}' -H 'content-type: application/json'`
  (or `pak_register_demo` once the Planner has respawned). Sharp edges found the hard way:
  **any non-production server that has the demo routes must set `REPO_DIR` to a throwaway
  directory**, or a test run does a real `git fetch` + `pnpm install` and registers a worktree in
  the live checkout — `playwright.config.ts` now does exactly that, which is what keeps `pnpm smoke`
  safe to run while the factory is up. And **the Pak's service worker will hijack anything served
  outside the Pak**: `workbox.navigateFallback: '/index.html'` answered the player's iframe with the
  Pak's own shell, so the game never loaded and every piece of feedback was silently text-only.
  `navigateFallbackDenylist: [/^\/play\//, /^\/api\//]` in `factory/pak/vite.config.ts` fixes it
  and `vite.config.test.ts` pins it. Add any future non-Pak route to that denylist **and** to the
  Vite dev `server.proxy`. None of this is visible to typecheck, lint, unit tests or CI — it only
  shows up in a real browser against the built Pak.

- **`gh pr review --request-changes` fails on Codex PRs** ("Can not request changes on your own pull
  request" — Codex pushes as drufball). Use `gh pr comment` for the record, then
  `codex cloud exec --branch codex/<slug>`. ~~PROTOCOL/skills still say `--request-changes`~~
  **fixed 2026-09-05 by the 1.7 lead** — PROTOCOL §2/§6 and `skills/review-pr.md` now say
  `gh pr comment`.
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

- ~~Pak theme is a clean baseline, not yet the chunky bevelled console look~~ **done 2026-09-06 by
  quest `pak-theme` (PRs #91, #95, #100). The 1.11 "theme pass" is spent — 1.11 should not re-do it.**
- ~~Pak `LiveEventsProvider` still keeps `lastEvent` in provider state~~ **removed in PR #100** —
  nothing read it; every consumer uses `subscribe(kind, …)`. No more whole-tree re-render per event.
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
- ~~**New Wake tools need a Planner restart**~~ **fixed 2026-09-05 in #93 — and Claude Code does
  honour it.** The channel adapter now declares `tools: { listChanged: true }`, keeps its tool list
  behind a swappable registry (`createToolRegistry` / `registerPakTools(...).swap` in
  `factory/wake/src/channel.ts`), and `factory/wake/src/reload.ts` re-imports the built
  `dist/channel.js` with a cache-busting `?reload=<ts>` query, swaps the registry and sends
  `notifications/tools/list_changed`. Two triggers: a debounced (750ms) `fs.watch` on its own
  `dist/` — so a plain `pnpm --filter @wyld/wake build` is enough — and `SIGHUP`
  (`kill -HUP <pid>`; the adapter logs its pid at startup as `wake channel hot reload armed`).
  Each reload logs `wake channel reloaded its tools` with `added`/`removed`/`toolCount`.
  **Empirical result (lead, 2026-09-05 ~23:16):** a real Claude Code session (v2.1.261) with the
  adapter as an MCP server listed 23 `pak_*` tools; a new tool was then written into its `dist` and
  the watcher fired; the session's MCP log recorded `Received tools/list_changed notification,
  refreshing tools`, and the very next turn listed 24 tools including the new one — **no restart**.
  Caveat: that probe session ran without `--dangerously-load-development-channels` (the classifier
  blocks scripting a keypress through that launch warning), so the tool refresh is verified on the
  ordinary MCP path; the channels flag only gates channel *notification* delivery
  (`Channel notifications skipped: server wake not in --channels list`), which is a different code
  path. Limitation: re-importing `channel.js` does not evict `@wyld/shared` from Node's cache, so a
  tool whose schema lives in `@wyld/shared` still needs a restart to change shape; adding or
  removing a `pak_*` tool in `channel.ts` does not.
  **One-time catch:** the currently running adapter predates #93, so it cannot reload itself. The
  Planner should respawn `wyld:planner` **once** to pick up the new adapter (that also loads
  `pak_register_demo`, `pak_read_demos`, `pak_read_feedback` from #84). After that respawn, new
  `pak_*` tools should appear live and no further restarts should be needed for tools.
  Keep sending `pak_health_report` after every batch of actions — `planner_state` plus
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
- ~~**A new event kind silently freezes the whole channel until the Planner restarts**~~
  **fixed 2026-09-05 in #90.** The old failure: `parseClaimResponse` validated every claimed message
  with `WakeMessage` (a `z.enum` kind), so one message with a kind the adapter's copy of
  `EVENT_KINDS` had never heard of made `claim()` throw and the loop retried the same batch forever
  — nothing behind it was ever delivered. Now: `@wyld/shared` exports `WakeMessageWire` (any
  non-empty `kind`/`source` string, everything else unchanged); `parseClaimResponse` parses per
  message and returns `{ messages, dropped }`; the delivery loop acks delivered **and** dropped ids
  (and acks what it already emitted before re-throwing an `emit` failure, so a retry cannot
  double-deliver); `POST /queue/claim` serialises rows with the same tolerant schema and **marks a
  row it cannot serialise as delivered**, so a poison row leaves the queue instead of sitting in the
  oldest-20 claim window forever. `pak_read_events`' `kinds` filter and `pak_log_event` no longer
  gate on the adapter's stale `EVENT_KINDS` (the server still validates what it stores).
  `EVENT_KINDS` remains the documented vocabulary for **ingress** (`POST /event`, `POST /gh`),
  unchanged. **The old "respawn the Planner after adding an `EVENT_KINDS` entry" rule is retired.**
  Verified by the lead on a scratch daemon (throwaway `FACTORY_DIR`, own port, no `WAKE_URL`) seeded
  with an unknown kind, an unknown source, a malformed row and a good message behind them: the old
  adapter delivered nothing (`queueDepth` stuck at 5, `lastDeliveryAt: null`, back-off doubling),
  the new one delivered all four good messages in timestamp order and drained `queueDepth` to 0 with
  one logged warning. The old tell (`GET :8788/health` showing a climbing `queueDepth` with a frozen
  `lastDeliveryAt`) is still the right thing to look at if delivery ever stops for another reason.

## Seeded data (2026-09-05)

The Pak's SQLite (`.factory/pak.sqlite`) is seeded with the real plan, via the API, not code:

- World `pak` "Expansion Pak" (`factory`, order 0) — quests for steps 0–1.3 in `done`, and one
  `idea` quest per remaining step 1.4–1.11, each with a one-line friend-pitch.
- World `fieldwork` "Fieldwork" (`game`, order 1) — no quests yet; the game spec becomes its
  quests in Phase 2.
- Next action: "Type what we should make next" → `/`.

`.factory/` is gitignored, so a fresh clone starts empty. Re-seed with `POST /api/worlds` and
`POST /api/quests` if the database is ever rebuilt.
