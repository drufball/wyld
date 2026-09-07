# Planner state — read this first on every new session

_Last updated 2026-09-06 ~14:58 BST by the Planner (first session on the new Mac). Quests in the Pak carry the
live state; this file is down to environment facts and open items. Keep it short; update it whenever a
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
| `improved-chains` (Dru 2026-09-06 ~09:05: Rumbles as chains, quest-attached chains, snooze, fold-up, Today composer FAB) | done, in `demo` | #113 server (rumbles unified with chains + snoozing), #118 Wake chain kind filters, #119 Pak (unified chains/rumbles/snooze/composer). Main disc rebuilt 09:55. Follow-up raised with Dru as a question chain 10:05 (card chrome: follow-up box + three buttons per card) — build only if he says so |
| `planner-in-pak` (decided 2026-09-06 08:14) | done, in `demo` | #112 `factory/planner-host` (Agent SDK host, streaming input, claims Wake's queue, resumes session id, `:8789/health`), #121 `factory-up.sh` `PLANNER_MODE` host\|cli + doctor "exactly one Planner". **Cutover executed 09:58**; first host session up 10:00 and announced. `unattended-restart` closed as done 10:01 |
| 1.10 Sleep Mode + Memory Card (quest `sleep-mode`) | done, in `demo` (2026-09-06 11:20; three PRs, one fix round each) | #125 shared+server (`sleep_runs`/`retros`, `POST /api/sleep/goodnight|:id/phase|:id/end`, `GET /api/sleep/current|runs`, `GET/PUT /api/retros[/:date]`, 30 s scheduler on local time `SLEEP_TZ`/`SLEEP_GOODNIGHT` 23:00/`SLEEP_LAST_CALL` 07:15/`SLEEP_LIGHTS_ON` 08:00/`SLEEP_SCHEDULE`, idempotent alarms in `alarms_fired`, 08:00 guard ends run `timed_out` + mechanical retro + **overwrites the next action** with "Good morning — nothing needs you yet"; forwarder lets only `sleep.alarm` through), #129 Wake (`sleep.alarm` normalised, `run` carried in the WakeMessage/claim/channel tag, tools `pak_read_sleep`/`pak_advance_sleep`/`pak_end_sleep`/`pak_write_retro`/`pak_read_retros`), #131 Pak (`/sleep` GOODNIGHT + phases + countdown + CSS night scene, `/memory` save-file cards, Today moon button + dismissable last-night card, smoke 10/10). Planner-side: `skills/sleep-mode.md`, `skills/write-retro.md`, PROTOCOL §2 rows. **First real night is 2026-09-06 23:00.** |
| `try-it-cards` (Dru 2026-09-06 10:53) | done, in `demo` (16:45; five PRs) | #137 shared+server (`demos.kind` disc\|live\|pak, `summary`/`steps`/`seeded`/`deep_link`, live → `ready` w/o builder, migration 0012), #139 wake `pak_register_demo` fields + validation, #141 Pak one Demos grid + `/demos/:id` live card + quest-card Try it (2 fix rounds), #145 `kind: 'pak'` branch Pak builds under `/play/<slug>/` (`PAK_BASE`, router basename, no SW off `/`; 2 fix rounds), #147 pak build needs `@wyld/shared` built first (`--filter @wyld/pak...`). `skills/merge-and-ship.md` §3: every quest reaching `demo` registers a card |
| `quiet-chain-cards` follow-up (Dru 15:04) | done, in `demo` | #143 no arrow (sr-only toggle), header row only with a quest chip, lucide `Ellipsis` icon button beside Settled |
| 1.11 `polish` "Sofa polish" | done, in `demo` (19:06; five PRs) | #150 doctor Serve-on-443 + `factory-up` public URL; #151 Go Outside sunset + `NextAction.backAt` + `pak_set_next_action back_at` (1 fix round: sun hidden behind hills, `slice` crop — screenshots only); #153 achievements (table + 7-rule catalogue in `factory/server/src/achievements.ts`, `pak.achievement_unlocked`, `GET /api/achievements`, Memory wall + Today toast; 1 round); #157 SFX/haptics (WebAudio, `wyld.sfx`, off on coarse pointer, switch on Debug; 1 round); #161 snoozed Rumbles don't block the sunset or the "N Rumbles" line (2 rounds). Card registered, deep link `/memory` |
| 1.9 Debug Menu explorer/event stream | not started | see factory-spec.md §11 |

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

- **The factory lives on the always-on laptop since 2026-09-06 14:54 BST** (quest `new-home`): host `Drus-MacBook-Pro.local`,
  user `crawnk`, repo `/Users/crawnk/wyld`, tailnet name `drus-macbook-pro-1.taild72c8d.ts.net`. Pak at
  `https://drus-macbook-pro-1.taild72c8d.ts.net/` (Serve 443 → 8787), ntfy at `…:8443` (→ 8790, topic `wyld-pak`,
  container `wyld-ntfy` under **Colima** — doctor shows port 8790 owned by `ssh`, that is Colima's port forward, not a
  stranger). Planner transcripts: `~/.claude/projects/-Users-crawnk-wyld/`. Imported from the old laptop's export
  (`MacBook-Pro-72.local` / `macbook-pro-6.taild72c8d.ts.net`, taken 13:35Z at commit ccb9e5b); `.factory/env` had
  `PAK_PUBLIC_URL` re-pointed by the setup session, `NTFY_BASE_URL` left empty (derived from the tailnet). Doctor: 35 ok.
  Any `macbook-pro-6` / `/Users/drufball/code/wyld` mention further down this file is historical.
- Codex environment **ID** `6a9be268ad288191b44bbdefcbe977ee` (label `drufball/wyld` resolves to
  a different, token-less environment — never use the label). `GH_TOKEN` there is a fine-grained
  PAT that **expires around 2026-10-05**; rotating it is a Rumble (account action by Dru).
- `@codex` mentions on GitHub are never used (env-less runs cannot push).
- Planner launch: `pnpm factory:up` → tmux session `wyld`; the `planner` window runs the **Agent SDK host**
  (`PLANNER_MODE=host`, default): `node factory/planner-host/dist/main.js` in a restart loop, health on
  `:8789/health`, session id in `.factory/planner-session.json`. The CLI path
  (`PLANNER_MODE=cli`, `claude --dangerously-load-development-channels server:wake`, needs a keypress) is the
  fallback until ~2026-09-13; see reference/channels.md.
- No branch protection (Free plan, private repo) — Dru chose convention: only the Planner merges,
  only green.
- TypeScript pinned 6.0.3 (typescript-eslint peer range). Tailscale is logged out on the laptop
  (needed at 1.11 → Rumble then).

## First actions for the on-duty Planner (fresh host session)

_Rewritten 2026-09-06 ~10:10 by the first host session, after executing the cutover runbook (now deleted from
this file — it ran once and is done). You are a **fresh** session inside `factory/planner-host`: no memory beyond
this file, the Pak, and GitHub._

1. **You are the host** on the always-on laptop (`/Users/crawnk/wyld`). Events reach you as `<channel …>` tags batched
   inside user messages (several per message, timestamp order); act on each per PROTOCOL §2. Your `pak_*` tools come from the wake adapter over
   stdio (`WAKE_CHANNEL_PUSH=0`). Sanity: `curl -s localhost:8789/health` shows your session id and
   `./scripts/factory-doctor.sh` says `Planner is running as the host`. No keypress exists anymore.
2. Load the wake tools (ToolSearch `select:mcp__wake__pak_*`). `pak_health_report` first (the Debug tile reads
   `down` after ten quiet minutes), then `pak_read_chains kind=all` and answer anything open in the same turn.
3. **Re-adopt in-flight work from GitHub, not memory:** `gh pr list` / `gh issue list`. Every open item belongs to
   the quest in its `<!-- quest:… -->` marker; spawn one lead per quest with open work and hand it the PR/issue
   numbers. Leads die with the session that spawned them, so anything mid-flight at a restart is yours to re-adopt.
4. Leads: one opus lead per quest (Agent tool, background). **Every lead brief must include:** the design
   decisions already made (state them; open questions come back as invented answers), unique scratchpad files per
   quest+unit under `/tmp/wyld-leads/<quest>/`, read the marker/Closes line back from GitHub after filing, name
   the branch in the Codex prompt, one Codex task per issue, run what Codex shipped against a scratch stack
   (`FACTORY_DIR=<tmp>`, `WAKE_URL`/`NTFY_URL` unset), never post to the live notifier, never touch
   `.factory/env`, deploy after every merge (merge-and-ship §2), and leave `pak_set_next_action` /
   `pak_health_report` to the Planner. Waits are single loops capped at 30 min; a lead that hits the cap reports
   back instead of looping.
5. Next quests, in order: finish `sleep-mode` (1.10; write `skills/sleep-mode.md` + `write-retro.md` yourself
   while its lead builds), then `polish` (1.11), then Phase 2 game quests in world `fieldwork`.
6. Restarting yourself is safe and unattended: the host resumes your session id from
   `.factory/planner-session.json`; a crash restarts in 5 s. A schema change in `@wyld/shared` that alters a
   tool's shape still needs the wake adapter restarted (`tmux respawn-window -k -t wyld:wake`); adding a tool does
   not (hot reload).

## Open items

- **16:10 M1 "Creatures exist" is complete on `main` (`90d3363`; four units, PRs #200/#203/#207/#209, one round each plus a
  verification-record push) — `game/VERIFICATION.md` M1: eight checkpoints, all PASS.** M1 explainer published (v1, pins on;
  species cards, who's-about clock, detection-eye rehearsal); roadmap v7 shows M1 landed / M2 now. **M2 "The field guide" started
  16:11** — lead reads `/tmp/wyld-leads/fw-m2/brief.md` (units: notebook model, tracks+observation+toasts, guide book, map with fog
  of war; disc `fw-m2-guide`). The M1 lead's final disc/card/quest→demo and report are still landing; next action and Catch-Up
  refresh follow them.
- **15:27 M2 brief written** at `/tmp/wyld-leads/fw-m2/brief.md` (the pure notebook; tracks decals + observation + toasts; the
  guide book with the merge animation; the map with fog of war) — spawns the moment M1's unit 4 lands. M1 unit 4 (detection, #208)
  with Codex. **Checked a claim in the M1 lead's unit-3 note** ("calls from eleven species at the pond after dark"): `spawn.ts`
  gates every maintain pass on `isEligible` (line 81) and despawns now-ineligible creatures > 80 m on `phaseChanged` (130–135), so
  the habitat rules hold — the count was world-wide `creatureCalled` events, not earshot; lead asked to reword the note. Rule:
  a lead's quest note is Dru-facing — a surprising number in one gets checked against the code before it stands.
- **15:24 M1 unit 3 landed** (#205 / PR #207 spawn system + wander + synthesised calls, one round — spawn/wander/call scheduling split
  into independent seeded RNG streams for determinism); unit 4 (detection) next, then `fw-m1-creatures` → `demo`. **Second deflake
  (#204 / PR #206) root cause, for anyone writing Pak tests:** RTL's `waitFor`/`findBy*` sets `IS_REACT_ACT_ENVIRONMENT=false`, so
  they resolve on the DOM mutation without guaranteeing React 19 flushed the passive effect that registers a listener — a single-shot
  `fireEvent`/`dispatchEvent` into a not-yet-listening component is dropped forever. Pattern: re-fire inside `waitFor` until the
  component proves it consumed the message (`fromFrame` helper in `Explain.test.tsx`), never a synchronous assertion after a
  dispatch; mutation-probe the rewritten test (delete the listener, it must fail).
- **15:06 M1 units 1–2 landed** (#198 / PR #200 species data + individuals, one round; #202 / PR #203 body plans + `spawn` debug
  command, one round — spawn placement uses the player's −z forward per the M0 axis convention); disc `fw-m1-creatures` `ready`;
  next action points Dru at `spawn loamox` etc. Unit 3 (spawn/wander/calls, #205 / PR #207) under the lead's review; unit 4 (detection)
  next. **Second deflake merged (#204 / PR #206)** — the hello-handshake test. Dru last seen 10:51 local; a Planner Catch-Up was
  written at 14:46 over events 1261–1409 and is rewritten after each merge (new events invalidate it). M1 explainer drafted at
  `/tmp/wyld-leads/artifacts/explainer-fw-m1.html` (species cards, who's-about clock, detection-eye rehearsal) — publish after units
  3–4 so it doesn't promise what the disc lacks.
- **14:29 second Pak flake:** PR #201's own new test ("recovers frame readiness by asking again with hello") reddened the game PR
  #203 in CI seven minutes after landing — 6/6 green locally under CPU pressure; re-run requested; deflake lead on
  `codex/artifacts-deflake-2`. **Rule for leads adding Pak tests that simulate `postMessage`/effects: loop the file ≥ 20× under CPU
  pressure with `--pool=forks` before merging — a green single run proves nothing on the 2-core runner.** M1 lead told: a Pak-only
  test reddening a game PR is a re-run, not a fix round. CPU hogs for local loops must be killed by pid (`pkill -f` chokes on the
  regex parens).
- **14:22 pin-ready handshake landed (#199 / PR #201, one test round)** — viewer sends `wyld:pin:hello` after installing its
  listener and on iframe `load`; the frame answers `ready` to `hello` and on `load` too. **All three explainers republished with the
  new snippet** (`artifacts` v6, `fw-m0-world` v2, `roadmap` v6; `publish.mjs --force`); served HTML verified to carry the `hello`
  handling. `artifacts` returns to `demo` with the lead's deploy. M1 unit 1 (species data + individuals, #198 / PR #200, one round)
  landed 14:11; unit 2 (body plans) with Codex.
- **13:47 pins deflaked (#195 / PR #197, test-only, zero rounds, 40/40 green under CPU load; vitest 5 flag is `--pool=forks`,
  `--poolOptions.*` is gone) and a real product race surfaced:** the embedded bridge posts its only `wyld:pin:ready` on
  `DOMContentLoaded`, before `ArtifactViewer`'s passive effect installs the parent listener — a fast frame (or Safari) leaves the
  Pin button `aria-disabled` until reload. Fix in flight as a two-way handshake (viewer `hello` after installing its listener and
  on iframe `load`; frame replies `ready` to `hello` and also on `load`), lead on `codex/artifacts-handshake`; `artifacts` back to
  `building`. **After it merges, republish all three explainers with the new `PIN_BRIDGE_SNIPPET`** (`publish.mjs` skips unchanged,
  so force by touching the drafts or delete the skip once) — old HTML carries the old snippet.
- **M0 lead's findings (13:42), for every game lead:** spec resolutions — east = +x, north = −z, sea level y = 0; region radii ≈
  half the nearest-neighbour distance, overlaps resolve to smallest dist/radius, ties by ascending id (`pointToRegion` is total);
  all 8 camps placed on standable ground; the one directional light is placed at `player + sunDir × 120` with a ±60 shadow frustum
  (§4.3 vs §14.5); `time <phase>` from inside that phase jumps a full day and **emits `phaseChanged` for every skipped boundary**.
  Run-only defects (none visible in a diff): unhandled `requestPointerLock()` rejection; camera below the knees + inverted mouse-Y;
  the archipelago was a beach (Channels at +7.2 m — found by rendering an offline map from `game/src`, not by a screenshot); sky
  colours fed as linear not sRGB (Night came out `pow(v,1/2.2)`); unit 4 overwrote unit 3's `sun.position`. Tooling: headless
  Chromium can't grant pointer lock, so a probe sees one 48° frustum — expose state via `__wyld`; `renderer.info.render.triangles`
  includes the shadow pass; `tsx` is at `node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs`. Codex ~5–10 min/round today
  (yesterday ~29); all four M0 units shipped real tests first pass. Leftover: Ash Fields reads bare from Ash Camp facing north —
  a props-density round if the fps has headroom.
- **13:41 M0 "Walk the world" is complete on `main` (`9b8ee13`, four units, PRs #189/#191/#193/#196, one round each); final disc
  `ready`.** `game/VERIFICATION.md`: four PASS (seeded RNG, region lookup, water/slope traversal measured at exactly 0.60 m and 56–64°,
  the 12-minute day at 9.98 s/10 s with `time Night` dropping sky brightness 122.7→28.1) and **one PARTIAL — 60 fps on an integrated
  GPU cannot be measured under SwiftShader** (7.8–37.2 fps there; triangles ≤ 114k post-cull, under the 200k cap). The next action
  asks Dru to read the frame rate via `?debug=1` on the disc; if it's under 60 on his laptop, a perf unit goes on `fw-m0-world`.
  **M1 "Creatures exist" started 13:42** (lead reads `/tmp/wyld-leads/fw-m1/brief.md`; units: species+individuals, body plans, spawn+
  calls, detection; disc `fw-m1-creatures`). Judgement call, recorded: M1 started with M0's fps checkpoint open, because creatures
  don't depend on it and the fix is an M0 unit either way. Roadmap explainer v5 shows M0 landed / M1 now.
- **13:37 M0 unit 3 landed** (#192 / PR #193 water/sky/12-minute day/HUD/`time`+`tp`, one round; disc `ready`); unit 4 (props/perf/
  `VERIFICATION.md`, #194 / PR #196) is in a fix round. **`main` flickered red at 12:06Z on `factory/pak` `Explain.test.tsx`
  ("keeps pinning disabled until the frame is ready…") on a commit that touched only `game/`** — 5/5 green locally, green on
  re-run (`gh run rerun <id> --failed` is within POLICIES #5), so a CI-only timing flake in the pins viewer test; deflaked in
  #195 / PR #197 (merged 13:36). Rule: a red on `main` for a test the merge didn't touch ⇒ re-run first, then deflake; leads
  told to re-run rather than fix-round when *that* test alone reddens their PR. M1 brief is written at
  `/tmp/wyld-leads/fw-m1/brief.md` and spawns the moment M0's checkpoints pass (spec §17 order).
- **12:33 M0 units 1–2 landed** (#188 / PR #189 engine+player, one round; #190 / PR #191 terrain/biomes/regions, one round). The
  first game disc `fw-m0-world` is `ready` at `07e4bca` (four biomes, 18 regions, 8 camps in `game/src/data/world.json` — names match
  the spec exactly), the Walk-the-world explainer is published (v1, pins on; draft at `/tmp/wyld-leads/artifacts/explainer-fw-m0.html`),
  and the next action points Dru at the disc. Units 3 (water/sky/time) and 4 (props/perf) follow. `publish.mjs` now skips unchanged
  explainers (it had re-versioned `artifacts`/`roadmap` needlessly) and defines `base`.
- **11:23 (2026-09-07) Phase 2 started.** FIELDWORK (`wyld-spec.md`) laid out as **eight quests in world `fieldwork`, one per spec
  milestone M0–M7, strictly in order** (§17: "do not start a milestone until the previous one's checkpoints pass"): `fw-m0-world`
  (building), `fw-m1-creatures`, `fw-m2-guide`, `fw-m3-combat`, `fw-m4-training`, `fw-m5-traversal`, `fw-m6-sightings`,
  `fw-m7-polish`. M0 lead spawned (scratchpad `/tmp/wyld-leads/fw-m0/`), four units: engine core + player (`codex/fw-m0-engine`),
  terrain/biomes/regions + `world.json` (`codex/fw-m0-terrain`), water/sky/time + HUD + debug `time`/`tp` (`codex/fw-m0-time`),
  props + perf + `game/VERIFICATION.md` (`codex/fw-m0-props`). Game rules in every game brief: no franchise terms (§0), no external
  assets, no UI frameworks, procedural everything, `window.__wyld` hooks kept (+ `debug(cmd)`, `perf()`), the disc re-registered
  after every merge (`pak_register_demo kind=disc slug=fw-m0-world`), leads run the built game under SwiftShader and look at
  screenshots; SwiftShader fps is not the 60-fps budget — record honestly. Roadmap explainer v3 shows the eight quests; Dru told
  via a message chain on `fw-m0-world`. **Every game quest ships with a disc, a try-it card and an explainer (the Planner writes
  it).** Explainer publishing: `/tmp/wyld-leads/artifacts/publish.mjs` (run with `npx tsx` from `factory/server`) appends the pin
  bridge from `factory/pak/src/lib/pin-bridge.ts` and POSTs both drafts.
- **`one-mechanism` unit 1 landed 19:59 (#164 / PR #165, one fix round)** — `ChainKind` + `demo|action|unlock`, `chains.tags/
  demo_id/payload`, migration 0016 backfill (one demo chain per demo, one action chain from presence), `close {reason:'done'}`
  marks the quest done, **`POST /chains/:id/reopen` is the un-done**, hide ⇔ settle, `needsYou` on `GET /api/presence`
  (open + unsnoozed question|message|rumble|demo), `GET /chains` default unchanged, comma kinds + `all`. Helper
  `factory/server/src/chain-cards.ts`. Fix round: Codex shipped **zero route tests** and a migration defect (`json(steps)` wrote
  `"steps": null` for NULL columns — the live `main` row). Live: `needsYou: 3`, doctor 36 ok.
  **LEAK, root cause found:** the Planner host is launched with `set -a; . .factory/env`, so **every lead's Bash inherits
  `WAKE_URL`/`WAKE_SECRET`/`NTFY_URL`** and any scratch server forwards fixtures to the live Wake (chains 9/4/5/1, `seed-quest`,
  `q1` arrived 19:44–19:45 as `human.*`). `unset` in one Bash call does not carry to the next. **Rule for every lead brief: prefix
  every scratch server / test command with `env -u WAKE_URL -u WAKE_SECRET -u NTFY_URL -u NTFY_BASE_URL`.** Proper fix (Sweep
  candidate, `night:`): `factory/planner-host` passes those three only to the adapter child (`mcpServers.wake.env`) and deletes
  them from its own `process.env` before the query starts, so subagent shells never see them. The tell stays: a `human.*` event
  absent from `pak_read_events` is a leak.
- **`one-mechanism` unit 2 landed 20:15 (#166 / PR #167, zero fix rounds):** `pak_read_chains kind` = one kind | comma list | `all`,
  plus `status` (`open`|`settled`|`all`); `pak_close_chain reason` (`settled`|`done`); new `pak_reopen_chain`. Lead drove the built
  registry against a scratch Pak (28 assertions incl. done→hide→reopen round trip), clean of `WAKE_URL` per `ps eww`. Host
  restarted at the lead boundary 21:18 for the changed shapes. Edges: comma is `%2C` in the URL; the tool's `status` omits
  `converted` (server accepts it); `kind` has no JSON `enum` any more (prose only).
- **11:20 both landed four seconds apart — #185 pins (`4e454d6`) and #187 leftovers (`007ffd1`) — no rebase between them;**
  verified the combined head myself: typecheck, Pak 165/165, build; CI on `007ffd1` pending at the time. `artifacts` → `demo`
  (pins: `postMessage` bridge the artifact opts into via `PIN_BRIDGE_SNIPPET` from `factory/pak/src/lib/pin-bridge.ts`
  (2517 chars, ES5, composed from `PIN_BRIDGE_SOURCE` — extract with `tsx` from `factory/server`, not a regex; publisher script
  `/tmp/wyld-leads/artifacts/publish.mjs`), Pin toggle in the viewer, numbered markers at exact rects, "Pinned to" on cards).
  **Both explainers republished with the bridge: `artifacts` v3, `roadmap` v2; `roadmap` quest → `demo` with a card;
  next action → /roadmap.** Leftovers: `Quests.tsx` reads demo chains, `listDemos` gone, unlock toast gone (chime on the card).
  Lead edges: (1) **Codex's fifth false self-report** — zero new tests while "pnpm test passed"; diff `it(` counts vs `main`;
  (2) **`onLoad` on a sandboxed iframe races the frame's own `DOMContentLoaded` message** — fine on Chromium (process
  isolation), would kill pins on Safari; caught by reading, not tests; (3) **Codex ~29 min/round today** — don't give up at 20;
  (4) `pnpm typecheck` doesn't cover `factory/pak/e2e`; (5) **the server emits no `planner.chain_updated` when it creates an
  unlock chain** — Today works around it; one-line server fix is tonight's `night:` item, then drop the workaround;
  (6) quest-card `Try it` for a live demo now goes straight to the deep link, bypassing the try-it card — `merge-and-ship.md` §3
  says the card sits behind it; revert to `/demos/<demoId>` as a `night:` item unless Dru prefers the shortcut; (7) scratch
  disc/pak demos can't reach `ready` (throwaway `REPO_DIR`) — set `status='ready'` in sqlite and restart so the boot sweep
  rewrites payloads; (8) never drive the live Pak in a browser (it posts `presence/seen`) — grep the served bundle instead.
  Host restart at this boundary 11:22 for the `pak_read_chains artifact` shape. **Next: Phase 2 — import FIELDWORK as worlds
  and first quests (world `fieldwork`), each shipping a disc + explainer.**
- **11:15 in flight:** `artifacts` unit 3 pins (#183 / PR #185, `codex/artifacts-pins`; one fix round; went DIRTY when unit 4
  landed on `ChainList` — lead merged `main` in, CI re-running) and `one-mechanism` unit 5 leftovers (#186 / PR #187,
  `codex/one-mechanism-leftovers`: `Quests.tsx` reads demo chains, drop the duplicate unlock toast; one fix round). Both touch
  `Today.tsx` — whichever merges second rebases. **Roadmap explainer drafted** at `/tmp/wyld-leads/artifacts/explainer-roadmap.html`
  (10.7 KB; Now/Next/Later + why, quests → pieces, FIELDWORK core loop, meters, shipped chips, `data-pin` everywhere); publish it
  and republish `artifacts` (v2) with `PIN_BRIDGE_SNIPPET` once pins land. **Rules from this morning:** (a) two Pak leads in
  parallel ⇒ the second to merge rebases; a lead's CI poll must treat "no new run within ~2 min of a push" as a conflict (check
  `gh pr view --json mergeStateStatus` for `DIRTY`), not wait the cap; (b) Wake can deliver a `github.push` minutes late and out
  of order — verify with `gh pr view --json headRefOid` before acting on it.
- **10:41 `one-mechanism` DONE → `demo` (unit 4 #182 / PR #184, one round).** `needsYou` counts `unlock`; unlock cards
  auto-settle after 8 s on screen (planner-sourced close); boot sweep `refreshDemoChainPayloads` (payload only — never via
  `ensureDemoChain`, which reopens); single reload per menu action; Hidden fold says `(reopens the quest)` when true. Leftovers:
  `Quests.tsx` still maps quest→demo via `listDemos` (file was the explainer lead's) — tiny follow-up; **Today shows both the
  unlock toast and the unlock card** — decide (drop the toast) in a follow-up. Lead edges: **Codex shipped zero tests on the
  first pass again** (make "does the diff add test files?" a mechanical pre-check); `codex cloud status` can read PENDING after
  the branch moved — poll `gh api repos/drufball/wyld/pulls/N --jq .head.sha`; the Bash tool caps at 600 s, so a 30-min wait is
  chained ≤8-min loops; scratch `POST /api/worlds` needs `kind`, `order`, `icon`.
- **10:03 `artifacts` unit 2 landed (#180 / PR #181, one round)** — `screens/Explain.tsx` (`/explain/:slug`, `/roadmap`, one
  `ArtifactViewer`: 61px header + full-bleed `<iframe sandbox="allow-scripts">` from `/artifacts/<slug>/?v=<n>`, reload on
  `planner.artifact_published` for its slug), Nav 7th entry ROADMAP/`MAP`, quest-card `Explainer` button, `e2e/explain.spec.ts`.
  **First explainer published 10:03 (slug `artifacts`, v1, 8.5 KB, drafted at `/tmp/wyld-leads/artifacts/explainer-artifacts.html`)**
  — next action points Dru at it. Edges: (1) **Codex ran zero verify commands and still opened the PR** ("environment command
  runner terminated the process") — fourth false self-report; (2) **a nav entry is a layout change** — the `min-[360px]` label
  switch was wrong for a phone all along; now `md:`; screenshots, not overflow checks, caught it; (3) `App.test.tsx` owns the
  nav-label contract; (4) scratch scripts inside a workspace package get linted — keep probes in `/tmp`; (5) desktop viewer uses
  `md:static md:h-[calc(100dvh-180px)]` so the nav stays reachable (copy for any full-screen nav destination). **Explainer
  authoring rule:** self-contained HTML, inline CSS/JS only, no external URLs, `data-pin` ids on things worth commenting on,
  Dracula palette inline; publish with `POST /api/artifacts` (or `pak_publish_artifact`); republish the same slug to refresh.
- **09:54 `one-mechanism` unit 3 landed (#177 / PR #179, three rounds: two substantive, one rebase)** — Today is one list
  (question|message|rumble|demo|unlock; `action` never fetched/rendered), `ChainCard` renders demo + unlock cards, Demos = filter
  with Snoozed/Hidden folds (`Show again` = reopen), sunset iff `needsYou===0`, VMU headlines `needsYou`; server: action-rotation
  settles are planner-sourced (regression test). Card registered; quest stays `building`. **For unit 4:** `unlock` chains are
  not in `needsYou` (unit 1 counts question|message|rumble|demo) → count them, or auto-settle unlock cards on view; the Hidden
  fold lists the old `polish`/`try-it-cards`/`quiet-chain-cards`/`main` cards — `Show again` un-dones those quests (by design;
  tell Dru); old demo payloads lack `status` (defaults `ready`); `DemoBody.runAction` double-reloads (harmless). Lead edge:
  throwaway `.mjs` probes inside `factory/pak` break `pnpm lint` — keep scratch scripts outside the lint root.
- **08:25 `artifacts` unit 1 landed (#176 / PR #178, two rounds).** Edges: (1) **adding a field to shared `Chain` breaks every
  hand-built `Chain` literal in Pak tests (TS2741)** — it bit both directions today (the artifacts PR vs `Rumble.test.tsx`, then
  the unit 3 PR vs `main`); when a unit widens a shared type, pre-authorise fixture touches and avoid running a second Pak unit
  in parallel with it; (2) **`@wyld/shared` stays DOM-free** — Codex had added `"DOM"` to its `lib` for `TextEncoder`, which
  shadows the package's own `Event` schema; reverted, measure UTF-8 bytes with a local helper; (3) **Codex non-publish #2** (a
  fix round went `ready` with no push) — the `codex cloud diff` fallback applies to fix rounds too; watch the builder token;
  (4) a polling loop must compare against a non-empty value (transient DNS returns empty and ends the wait early); (5) the wake
  registry has no `listTools()`; (6) **`pak_read_chains` gained `artifact` — host restart at the next lead boundary.**
  **Lead rule (new, 08:44): a lead must wait in ONE blocking `until … sleep 60` Bash loop; a lead that ends its turn "to wait"
  stops dead and needs a Planner message to resume** (the viewer lead did exactly that; resumed by hand at 08:46).
- **2026-09-07 morning.** No `lights_on` alarm arrived at 08:00 — the run had already ended, so the alarm is per-run; the
  Catch-Up Dru saw at 08:22 was whatever the overnight events left (rewrite it at Reset *last*, or accept the mechanical one).
  Env scrub verified live after the 23:00 restart: the Planner's own Bash has no `WAKE_URL/WAKE_SECRET/NTFY_URL/NTFY_BASE_URL`,
  `PAK_URL` intact. **Dru 08:23: "only 23 builders merged seems pretty low … should we just be more ambitious about doing work
  in parallel?"** Answered: builder ~5–8 min/unit, CI 3, the rest review + browser checks + 13 fix rounds; the limiter was
  sequential units and ≤3 leads. **Decision: run quests in parallel by default and size units bigger where packages don't
  collide; report cycle time per PR in tonight's retro** (derive from `gh pr list --state merged --json createdAt,mergedAt`).
  08:25: two leads spawned — `one-mechanism` unit 3 (Pak: one list on Today for question|message|rumble|demo|unlock, `action`
  never rendered, Demos/Rumble/VMU as filters, Hidden fold = reopen, sunset iff `needsYou===0`, action-rotation settles
  planner-sourced; branch `codex/one-mechanism-pak`) and `artifacts` unit 1 (server+shared+wake: `artifacts` table
  slug/quest/title/summary/html≤512KB/version, `GET|POST|DELETE /api/artifacts`, `GET /artifacts/:slug/` with a strict CSP and
  no X-Frame-Options, chains gain `anchor {artifact, element, label}` + `?artifact=` filter, tools `pak_publish_artifact` /
  `pak_read_artifacts`, `pak_read_chains artifact`, SW denylist + dev proxy for `/artifacts/`; branch `codex/artifacts-server`).
- **Sleep Mode run 1 (Dru pressed GOODNIGHT 22:06; ended clean 22:59).** Drain empty; Sweep = four `night:` items via one lead,
  all merged (#171 Today's ChainList owns its kind set — root cause was wider: Today passed `kind=all`, which #165 expanded to
  all six kinds, so `action`/`demo` chains were in the *fetch*, not just SSE; #173 `PausedBanner` test TZ-agnostic — `TZ=UTC`
  no longer needed on this Mac; #170 planner-host `scrub.ts` deletes `WAKE_URL/WAKE_SECRET/NTFY_URL/NTFY_BASE_URL` from
  `process.env` after `readConfig()` — proved on a scratch host: the `claude` child has none of them, the adapter grandchild has
  exactly its four; #175 `GET /api/rumbles` excludes future-snoozed unless `includeSnoozed=1`, catch-up digest too,
  **`pak_read_rumbles` always sends `includeSnoozed=1`** so the Planner still sees them). QA: build + smoke 12/12, all demos
  `ready` (Main hidden by Dru — never re-register it in QA), doctor 36 ok. Retro written (`2026-09-06`), catch-up + next action
  set; **rewrite the catch-up at `lights_on`** because overnight events turn it mechanical. Host restarted on #170 at 23:00.
  Corrections to earlier rules from the night lead: **`ps eww` shows exec-time env** (a runtime `delete` doesn't change it —
  check the child, not the host); **`mcpServers.<name>.env` MERGES** into the parent env (only `Options.env` replaces);
  `pnpm --filter A --filter B build` (not `--filter A build --filter B build`); `bootstrap.sh` in a worktree writes a
  worktree-local `.factory/env`. **Morning: `one-mechanism` unit 3 (Pak) at lights-on**, brief must include: `action` chains
  never render as Dru's cards and rotation settles are planner-sourced; `unhide` UI = reopen; questless building/failed cards.
- **Side effect of unit 1 on the live Pak (21:05):** `Today`'s `ChainList` appends any `planner.chain_updated` chain from SSE
  without filtering by kind, so each new `action` chain (every `pak_set_next_action`) appears as a card until reload; Dru settled
  two of them (chains 65, 66). Presence/`needsYou` unaffected. **Tonight's Sweep, first item (`night:`):** ChainList only
  appends live chains whose kind is in the set it fetched (question|message today). Unit 3 supersedes it tomorrow. Also for
  unit 3's brief: the server stamps the settle of a rotated `action` chain as `source: human` — make rotation settles
  `planner`-sourced and never render `action` settles as Dru's.
- **Unit 3 (Pak) starts at lights-on tomorrow, not tonight** (21:16 decision: biggest unit, would straddle the 23:00 Drain).
  Then (4) retire special cases. Units left on `one-mechanism`: (3) Pak — Today renders every kind as a card
  (demo cards with Mark done/Hide/Snooze, action card, unlock card), sunset uses `needsYou`, Demos/Rumble/VMU become filters over
  chains; (4) retire the special cases (`GET /api/rumbles` snooze, questless `building/failed` cards, unhide UI = reopen).
- **`try-it-cards` unit 7 Hide landed 19:17 (#162 / PR #163, zero fix rounds)** — `demos.hidden_at` (migration 0015),
  `POST /api/demos/:id/hide|unhide`, default list drops hidden, `?includeDone=1` = everything, re-register/build unhides; Pak
  `Hide` where questless, `Mark done` where quest-owned, never both. Quest back in `demo`, card re-registered. Lead's edges:
  **`PausedBanner.test.tsx` is red on this BST Mac on `main`** (third lead to hit it — tonight's `night:` Sweep item, pin
  `TZ` or format with the same `Intl` call); `unhide` has no UI (curl only); questless `building`/`failed` cards have no Hide;
  the live Pak opens on a Catch-Up overlay, so leads verify against scratch stacks only.
- **`polish` done 19:06 (lead report).** Sharp edges: (1) **Codex's "pnpm test passed" was false twice today** (#153: 16 Pak tests
  red; #161: 1 red) — never merge on its self-report, CI is the truth. (2) A leaked `vi.useFakeTimers()` cascades — restore in
  `afterEach`. (3) Locale-fragile date assertions (`en-GB` locally vs `en-US` in CI) — build expected strings with the same
  `Intl.DateTimeFormat`. (4) **`GET /api/rumbles` is not snooze-aware; `Vmu.tsx` still counts snoozed Rumbles** — fold into
  `one-mechanism`. (5) Writing a retro stores no event, so `streak-3` unlocks on the next stored event. (6) **Never load the live
  Pak in Playwright** — `CatchUpGate` posts "seen" on mount and would swallow Dru's pending catch-up; scratch stacks only.
  (7) `pak.achievement_unlocked` is deliberately not forwarded to Wake. **Also in flight:** `try-it-cards` unit 7 — Hide on
  questless demo cards (`hidden_at`, `POST /api/demos/:id/hide|unhide`; Dru 19:00: the Main creature disc "is just sticking
  around"), lead on `codex/try-it-hide`, #162. Dismiss lead's note: **Mark done is one-way in the UI** (no un-done; Park/Unpark
  lands on `building`) — fold an "undo" into `one-mechanism`.
- **Order revised 18:21 (Dru, on `polish` chain 59): `polish` → `one-mechanism` → `artifacts` → `roadmap` → Phase 2.** New `idea`
  quest **`one-mechanism`** "Everything is a chain": Rumbles already are chains; try-it cards/demos, the next action and unlocks
  become chains with tags; each screen filters by tag; snooze/settle/Mark done are one mechanism; "nothing needs you" = no open,
  unsnoozed chain addressed to him. Dru verbatim: "rumbles and try it cards and demos should all just be chains … Each
  differentiated screen just maybe reads tags instead of a special data type?" Also: **snoozed Rumbles must not block the
  sunset** — queued as `polish` unit 5 (`codex/polish-sunset-snooze`) with the polish lead. `quiet-chain-cards` alignment
  landed 18:18 (#155 / PR #158, +2/−1, zero fix rounds) → `demo`, card re-registered, fresh spare chain seeded.
  Lead sharp edges: `git worktree remove /tmp/...` fails because `/tmp` → `/private/tmp` (use the resolved path or `rm -rf` +
  `git worktree prune`); `gh pr checks` exits 8 while pending — poll `gh run view <id> --json status,conclusion` instead.
- **Roadmap direction from Dru (18:07–18:14, chain settled):** he wants the build managed as an *app*, never markdown/brain dumps —
  Claude-artifact-style interactive HTML explainers with Figma-style comment pins on any element that open a chain there. Two
  `idea` quests: **`artifacts`** "Explainer artifacts" (machinery: the Planner publishes a self-contained interactive piece per
  quest, rendered in the Pak; pin-a-comment → chain anchored to the element; per-quest explainer is never an issue list) and
  **`roadmap`** "Roadmap artifact" (the standing what-and-why: Now/Next/Later + reasoning, kept current). **Order (proposed, he
  settled the chain without objecting): `polish` → `artifacts` → `roadmap` → Phase 2 game work, each game quest then shipping its
  own explainer.** Design thoughts for planning `artifacts`: server table `artifacts` (quest?, slug, html, version, ts) +
  `pak_publish_artifact` tool; sandboxed iframe render with a pin overlay (anchor = artifact slug + element `data-pin` id +
  label) → `POST /api/chains` with `anchor`; pins shown while the chain is open; Planner (or a lead) authors the HTML — treat it
  like a catch-up: Planner output, not app code.
- **`polish` progress:** unit 2 achievements landed 18:03 (#152 / PR #153, one fix round: a Memory empty-state test broke on the
  new wall + a locale-order date assertion); live wall unlocked 4/7 from real history (first-quest-done, five-done,
  first-feedback, first-rumble). Unit 3 SFX PR #157 open 18:14. **Two feedback-driven follow-ups from try-it cards (both via the
  Feedback button — the loop works):** 18:03 `quiet-chain-cards` → `building`, #155 right-align the actions row (lead, branch
  `codex/quiet-chain-cards-3`); 18:05 `try-it-cards` → `building`, #156 Mark done on cards + hide demos of done quests (lead,
  branch `codex/try-it-dismiss`). Three leads in `factory/pak` at once on disjoint files.
- **Host restarted 16:45 at the lead boundary (`tmux respawn-window -k -t wyld:planner`) — session resumed, and the
  restart DID refresh the stale `pak_register_demo` schema.** So the rule is: a changed tool *shape* needs a host restart at a
  lead boundary; a new tool does not.
- **`polish` (1.11) lead spawned 16:49** (scratchpad `/tmp/wyld-leads/polish/`). Already done from the spec's list: PWA manifest/SW,
  Serve, `factory up/down/doctor`. Units: (1) Go Outside — `NextAction.backAt?` + `pak_set_next_action back_at` + Today's sunset
  panel when the next action starts "Nothing needs you" and no open chains/Rumbles (`codex/polish-go-outside`, #148 / PR #151);
  (2) achievements — table + seeded catalogue (First Light, Five Alive, Playtester, Night Shift, Decider, Early Bird, Three in a
  Row), rules in `factory/server/src/achievements.ts` evaluated per stored event, `pak.achievement_unlocked` event kind,
  `GET /api/achievements`, Memory wall + Today toast; (3) SFX/haptics — WebAudio chimes (no assets), `navigator.vibrate` on
  decisions, `wyld.sfx` in localStorage, off by default on coarse-pointer devices, switch on Debug; (4) doctor Serve-on-443 check +
  `factory-up` prints the public URL — **landed 17:09 (#149 / PR #150), doctor 36 ok.** Lead registers the try-it card at the end.
  First Sleep Mode night tonight at 23:00 local — leave nothing non-draft open by then. Then Phase 2 (`fieldwork`).
- **try-it lead's sharp edges (16:45):** (1) a builder path that only runs in production needs one *real* run before it counts as
  verified — `kind: 'pak'` shipped dead in #145 (fresh worktree lacks `factory/shared/dist`; the smoke spec ran inside a checkout
  that had it) and only the live run found it. (2) `playwright.config.ts` is evaluated once per process (runner + each
  worker) — module-scope `mkdtempSync` made two temp dirs; now stashed in `process.env.WYLD_E2E_DIR`. (3) **The live server runs
  `tsx watch src/main.ts`, not `dist`** — `factory/server/dist` goes stale; rebuild `@wyld/server` before verifying against
  `node factory/server/dist/main.js`. (4) `gh pr merge --delete-branch` also removes the local worktree on that branch; just
  `git worktree prune`. (5) An overflow check alone does not catch a broken card border — look at the screenshot.
- **Factory un-quieted 14:24 BST on Dru's word** ("just get started, no need to wait on phone"; he'll tap Done on
  `new-home-prep` after a race). Old laptop confirmed silent on the tailnet 14:20. **Lead spawned 14:24 for quest
  `try-it-cards`** (`planning`; scratchpad `/tmp/wyld-leads/try-it-cards/`), four sequenced units, all on `demos`:
  (1) shared+server — `demos.kind` `disc|live` (+`pak` in unit 4), `summary`, `steps[]`, `seeded[]`, `deep_link`; a live
  demo is `ready` at once, no builder; catch-up line uses the summary; (2) wake — `pak_register_demo` gains `kind/summary/
  steps/seeded/deep_link` (adapter respawn needed after shared shape changes); (3) pak — one Demos grid for discs and live
  cards (`TRY IT` badge, numbered steps, "What's already there", Try it → deep link, Feedback form), `/demos/:id` full-page
  card for live, quest card's Demo button becomes Try it/Play when a demo row exists; (4) `kind: 'pak'` branch builds of
  the Pak under `/play/<slug>/` (`PAK_BASE`, router basename, no SW when base ≠ `/`). Branches `codex/try-it-shared-server`,
  `-wake`, `-pak`, `-branch-build`. The lead registers this quest's own live card after unit 3. **Planner to-do when the
  tool lands:** rewrite `skills/merge-and-ship.md` §3 so every quest reaching `demo` registers a try-it card (summary,
  steps, seeded), and say in lead briefs that seeding test data is part of shipping.
- **`try-it-cards` units 1 and 2 landed** (14:41 #136/PR #137 shared+server — `demos.kind/summary/steps/seeded/deep_link`,
  live rows `ready` at once, build on live → 400, migration 0012 verified on the live db; 14:51 #138/PR #139 wake —
  `pak_register_demo` gained `kind/summary/steps/seeded/deep_link`, live needs a summary + ≥1 step, `deep_link` rejected on a
  disc). Zero fix rounds on both. Unit 3 (pak) next, then 4 (branch builds).
- **15:01 Dru tapped Done on `new-home-prep`**; old laptop answers 502 via its lingering Serve (factory down there — fine).
  `new-home` stays `demo` until he marks it done.
- **`try-it-cards` unit 3 landed 15:33** (#140 / PR #141, two fix rounds, both disc-player chrome regressions only a browser
  showed: the extracted `FeedbackForm` lost the ack's `Card variant="flat"` background, and a width on the shared form made
  the player's Feedback trigger a full-width bar — fixed by scoping the width to the player). Unit 4 (branch Pak builds) next.
  The lead registers this quest's own live card after deploying (curl fallback if its tool schema is stale).
- **`quiet-chain-cards` reopened → `building` 15:04 on Dru's feedback** (verbatim: no open/closed arrow — "obvious by the
  buttons appearing"; ⋯ next to Settled, no extra top row; then 15:05: "use an icon instead of the '...'"). Second lead
  spawned 15:05 (scratchpad `/tmp/wyld-leads/quiet-chain-cards/`, branch `codex/quiet-chain-cards-2`, #142 / PR #143):
  toggle kept as `sr-only focus:not-sr-only` so specs + keyboard access survive, header row only with a quest chip, menu
  button moved into the actions row beside Settled, `lucide-react` `Ellipsis` icon (Dru pre-approved lucide during the
  theme work). Runs alongside the try-it lead on disjoint Pak files.
- **`quiet-chain-cards` unit 2 landed 15:36 (#142 / PR #143, zero fix rounds) → `demo`;** Dru marked `new-home` and
  `planner-in-pak` done himself (15:3x). Planner registered the try-it card for `quiet-chain-cards` by curl (15:37) with a
  spare message chain on Today to practise on. Lead's sharp edges: (1) **Codex reached `ready` but never pushed a branch or
  opened a PR** (same env ID as always); the lead used the PROTOCOL §6 `codex cloud diff` fallback (worktree, six verify
  commands, commit authored as Codex, PR by hand). First time since the env fix — **if it recurs, suspect the builder
  `GH_TOKEN` (expires ~2026-10-05, Rumble `rotate-build-token`) before blaming Codex.** (2) **Playwright cannot `.click()`
  an `sr-only` button** (hit-test lands on the element clipping it) — use `.focus()` + `.press('Enter')`, which is the
  keyboard path such a button exists for. (3) `lucide-react@1.34.0` is now a Pak dep (no `minimumReleaseAgeExclude`
  needed). (4) `PausedBanner.test.tsx` still fails on this BST box without `TZ=UTC` — tonight's `night:` Sweep item.
- **Sharp edge (14:53): the host session does NOT see a hot-reloaded tool *shape*.** After PR #139 the rebuilt adapter
  (`dist/channel.js` has `deep_link`) and a `kill -HUP` on the Planner's stdio adapter child (`pgrep -f channel-main.js`)
  still left `pak_register_demo` with the old four-arg schema in this session's tool list. New tools appearing live was
  verified on the CLI path; a changed schema of an existing tool under the Agent SDK host apparently is not. **Workaround
  until the next host restart** (do it at the next lead boundary — `tmux respawn-window -k -t wyld:planner`, session
  resumes): register cards with `curl -X POST localhost:8787/api/demos` (camelCase `deepLink`). The lead has been told.
  Candidate `planner-host` unit: on `tools/list_changed`, restart the query (or the process) so the schema refreshes.
- `skills/merge-and-ship.md` now names `/Users/crawnk/wyld` as the live checkout (38b9200) and **§3 says every quest
  reaching `demo` registers a try-it card** (seed first, then `pak_register_demo kind=live …`; ce3baa7).

- **Move done 2026-09-06 14:54 BST; waiting on Dru's Done on Rumble `new-home-prep`** (re-filed in place with the two
  closing steps: `pnpm factory:down` on the old laptop, phone ntfy re-subscribed to the new `:8443/wyld-pak`). As of 14:56 the
  **old laptop's factory was still up** (its snapshot answered on the tailnet, Planner idle, queue empty) — harmless while
  nothing is in flight, but two `gh webhook forward`s and two Planners would both act on the next GitHub event, so
  **do not start Codex work until that card is Done** (or the old snapshot at `https://macbook-pro-6.taild72c8d.ts.net/api/health/snapshot`
  stops answering). `new-home` is in `demo`; Dru marks it done. After that, un-quiet the factory: `try-it-cards`, then
  `polish` (1.11), then Phase 2 in world `fieldwork`.
- **Sharp edge from the import (14:54):** the ops watchdog paused lane `planner` the moment the factory came up here, because
  the newest Planner heartbeat in the imported db was 19 min old; the host's first beat + `pak_resume planner` cleared it
  (outage card gone), but Dru got the buzz on the old subscription. Sweep item: after an import (or any cold start) the
  watchdog should require a beat that is newer than *its own* start before calling the Planner dead — or `factory:up` should
  report one before starting ops.
- **Tonight is the first real Sleep Mode night** (23:00 local; `SLEEP_TZ` empty ⇒ this box's zone, BST). Run
  `skills/sleep-mode.md` from the `goodnight` alarm. `recent` runs is empty — no history to compare against.
- Dru's last message on the move chain (13:34Z) was answered on the old laptop *after* the export was taken, so on this
  Pak it looked unanswered; answered again here 13:56Z with the new-Mac state. The pending copy of that event is still in
  Wake's queue (depth 1) and will arrive as a channel tag — it is already handled, do not answer it a third time.

- **Host restarted 2026-09-06 11:51** (same session resumed; `restarts=0` because the respawn replaced the window). Now running
  #124 self-heartbeat (`Handling events`/`Waiting for events — last turn HH:MM` rows every 120 s) and #129 framing; the five
  sleep tools are in the Planner's tool list; the temporary shell pulse is killed. `planner-in-pak` → `demo`.
- **`new-home` unit shipped 11:49 (#132 / PR #133, two fix rounds).** `pnpm factory:export [out.tgz]` → `~/Desktop/
  wyld-factory-<stamp>.tgz` (600): `.backup` snapshots of `pak.sqlite` + `wake.sqlite` (proved against live WAL: 10/10
  rows vs 0/10 for `cp`), `env` (600), `feedback/`, `ntfy/`, `export-manifest.json`; excludes demos/worktrees/
  planner-session/logs. `pnpm factory:import <tgz>` refuses over an existing db (`--force` moves the old aside to
  `pre-import-<stamp>/`), restores, runs bootstrap (non-fatal), prints ok/manual/warn lines and a loud HOSTNAME REVIEW
  block, exits 1 on hard misses (Node 22, `gh auth`, `docker info`, Tailscale running). Doctor gained fresh-machine and
  hostname-mismatch checks (34 ok here). `FACTORY_DIR` now honoured by bootstrap/doctor too. **`NEW-MACHINE.md`** (repo
  root, 148 lines) starts from a blank macOS: §0 human prelude (Setup Assistant → `git` for CLT → Claude Code install →
  `claude` login → clone → "follow NEW-MACHINE.md"), then the assistant installs Homebrew, `node@22` (keg-only — needs the
  `~/.zprofile` PATH line), Tailscale cask **plus the `/usr/local/bin/tailscale` shim the cask does not create**, Colima
  (`brew services start colima`), `gh`; stops only for Tailscale sign-in + Serve, `gh auth login` (HTTPS), Codex login.
  Rancher Desktop is no longer assumed anywhere (Dru, 11:29).
  Sharp edges: (1) **`factory/ntfy/server.yml` `base-url` is tracked and hardcodes `macbook-pro-6.taild72c8d.ts.net:8443`**
  — must be hand-edited on the new Mac (dirty tree) or iOS instant push breaks; templating it from env is a small
  follow-up unit worth doing before the move. (2) An export while the factory is up checkpoints the live WAL — the
  `-wal` shrinking to 0 afterwards is expected. (3) `pnpm format:check` is red on `main` for 13 unrelated files (not in
  CI) — Sweep material. (4) `~/.claude` is not migrated by design.

- **Host restart pending (as of 11:22):** the live host still runs the pre-#124/#129 dist — no self-heartbeat, and
  `framing.ts` omits `run=` on `sleep.alarm` tags (use `pak_read_sleep` for the id until then). Restart at the next
  lead boundary (`quiet-chain-cards` merging, `new-home` unit with Codex), then **kill the shell pulse**
  (`kill $(cat /tmp/wyld-planner-pulse.pid)`) and move `planner-in-pak` → `demo` with a note.
- **Plan for the move (Dru, 11:14):** finish the in-flight quests first, then stop starting work (quiet factory), then
  move. The `new-home` unit (#132) also ships a repo-root **`NEW-MACHINE.md`** that a fresh Claude session on the new Mac
  follows end to end; the import script prints pass/fail lines and defers to it. Two-step cutover confirmed: the old
  laptop's Planner keeps running until the new one is verified.
- **Sleep Mode sharp edges (lead, 11:20):** (1) `pkill -f 'node factory/server/dist/main.js'` matches nothing — the
  command line is cwd-relative; kill scratch servers by port (`lsof -ti tcp:$PORT | xargs -r kill`). (2) Pick scratch
  ports programmatically (8798 was transiently taken; a scratch server POSTed at a stranger). (3) **Any test asserting a
  formatted time must pin `TZ`** — `factory/pak/src/components/PausedBanner.test.tsx` fails on this laptop (BST) and
  passes in CI; `TZ=UTC` is green. Pre-existing; a `night:` Sweep item for the first Sleep Mode run, not a daytime task.
  (4) Unit tests that hand-build queue rows cannot catch a broken projection — anything travelling ingress → queue →
  Planner needs a test through the real endpoints (the `run` field was silently dropped by `/queue/claim`). (5)
  `tsx watch` on `@wyld/wake` picks up a rebuilt `@wyld/shared/dist`; the planner-host does not.

- **Quest `new-home` "Move to the always-on laptop" — TODAY (Dru, 2026-09-06 11:12; the work laptop leaves Monday).**
  Lead spawned 11:13 for the buildable unit (branch `codex/factory-move`): `scripts/factory-export.sh` (sqlite
  `.backup` of `pak.sqlite` **and** `wake.sqlite` — both WAL — plus `.factory/env`, `feedback/`, `ntfy/`; excludes
  `demos/`, `worktrees/`, `planner-session.json`, logs) and `scripts/factory-import.sh <tgz>` (refuses over an existing
  db without `--force`, restores, runs bootstrap, prints a checklist: gh login, Tailscale login + Serve 8443→8790,
  container runtime, Node 22, Codex login; **warns that `PAK_PUBLIC_URL`/`NTFY_URL` embed the old hostname
  `macbook-pro-6.taild72c8d.ts.net` and must be edited by Dru**). Rumble `new-home-prep` (account, blocks the quest)
  lists his four logins on the new Mac; next action points at it.
  **Runbook once the scripts merge (Planner on the old laptop):** (1) wait for a lead boundary — no open Codex PR,
  no lead mid-flight; (2) `pak_send_message` telling Dru the order below; (3) update the Rumble in place (same id) with
  the exact commands; (4) `pnpm factory:down` here **after** he confirms the import worked there — never two
  factories on one db/tailnet at once (two Wakes would both claim the queue; two ntfy Serves fight for the name).
  **Dru's order:** clone the repo on the new Mac → `./scripts/bootstrap.sh` → copy the export tgz over (Tailscale
  `tailscale file cp <tgz> <new-host>:` or AirDrop) → `pnpm factory:import <tgz>` → edit `PAK_PUBLIC_URL` and
  `NTFY_URL` to the new tailnet name → `pnpm factory:up` → re-subscribe the phone's ntfy app to
  `https://<new-host>.taild72c8d.ts.net:8443/wyld-pak` (the old subscription goes dead) → `pnpm factory:doctor`.
  **The Planner session on the new Mac is fresh** (no transcript there; `planner-session.json` is deliberately not
  exported): it reads this file, re-adopts open GitHub work, and must **kill nothing** — the shell pulse loop only
  exists on the old laptop. The Codex cloud environment and its `GH_TOKEN` are unaffected by the move. The old
  laptop keeps its clone; run `pnpm factory:down` there and leave it.

- **Two rules from Dru, 2026-09-06 ~10:50 (both now in PROTOCOL):** (1) never settle a chain he started — answer and
  leave it open; he taps Settled after reading (`pak_close_chain` only for chains the Planner opened). (2) `demo →
  done` is his acceptance: only he marks a quest done; the "quiet day → done" auto-close is gone.
- **Quest `try-it-cards` "Try-it cards" (Dru, 10:53) — `idea`, queued behind `sleep-mode` and `quiet-chain-cards`.**
  Every quest reaching `demo` gets a demo card: what changed at a glance, step-by-step how to try it, test data
  pre-seeded. Factory quests demo against the live Pak by default, **but a branch build stays possible and the Planner picks
  per quest** — big/risky changes or anything altering how Dru works get a branch demo before landing (Dru, 10:55);
  game quests keep their discs; one unified Demos screen shows both. Likely units: a `demos`
  row kind for "live" demos with `instructions` + `seed` fields, Planner tool to register one on shipping, Demos
  screen + quest card rendering, and a `merge-and-ship` step that writes the card.

- **Quest `quiet-chain-cards` "Quieter chain cards" (Dru, 2026-09-06 10:43, answering the Planner's question):**
  chain cards on Today collapse to just the conversation; tap → follow-up box + Settled; Make this a quest + Snooze
  behind a "⋯" menu; rumble chains unchanged. Pak-only, one unit. Lead spawned 10:44 (branch
  `codex/quiet-chain-cards`). Runs alongside the `sleep-mode` lead, whose Pak unit (3) starts only after its
  server unit merges — the chain-card change is confined to `ChainList.tsx`, so overlap is limited to Today.

- **Host heartbeat landed 2026-09-06 10:21 (#123 / PR #124, zero fix rounds) — takes effect on the next host
  restart.** Found 10:08 by the first host session: only the Planner's `pak_health_report` wrote `health_reports`,
  and the Planner only gets a turn on an event, so a quiet factory read as a dead Planner (ops watchdog pauses lane
  `planner` after 15 min and pushes to Dru). Now `factory/planner-host/src/heartbeat.ts` posts `plannerState`
  (`working` while a turn is in flight, else `idle`) + `currentTask` (`Waiting for events — last turn HH:MM`) every
  `PLANNER_HOST_HEARTBEAT_SECONDS` (default 120, `0` disables), first beat on `system:init`, one attempt per tick,
  failures logged and swallowed. Built in the live checkout; **the live host still runs the old build until
  `tmux respawn-window -k -t wyld:planner` with the launcher command from `scripts/factory-up.sh`.** A restart
  kills the session's running leads (they are subagents), so restart only at a lead boundary — the plan is to do it
  once the `sleep-mode` lead reports. **Bridge until then:** a detached shell loop started by the Planner (`nohup … curl -X POST localhost:8787/api/health/report` every 120 s with camelCase `plannerState`/`currentTask`; pid in `/tmp/wyld-planner-pulse.pid`). **Kill it after the restart** (`kill $(cat /tmp/wyld-planner-pulse.pid)`) or the tile will lie. **CronCreate does not fire under the host** (jobs need an idle REPL; there is none) — the first attempt at a cron bridge silently did nothing, the watchdog paused lane `planner` twice (10:39, 10:41; both auto-resumed by 10:45), and Dru got the outage buzz.
  Sharp edges from the lead:
  1. `WAKE_SECRET` is **not** in the tmux environment (`tmux show-environment -t wyld` carries only `NTFY_*`,
     `PAK_PUBLIC_URL`, ssh vars) — it lives only in `.factory/env` and the process env. A scratch host should use a
     throwaway secret and an unused `WAKE_PORT` (e.g. 8797) so it never touches the live Wake; the only cost is
     `planner queue claim failed; retrying` debug lines.
  2. A scratch host starts a **real Planner session in `bypassPermissions`** — pin `PLANNER_HOST_MAX_TURNS=1` and an
     inert `PLANNER_HOST_FIRST_MESSAGE` ("reply OK, use no tools") so it cannot wander.
  3. The liveness beat is now usually the newest `health` row, and `GET /api/health/snapshot` falls back to the
     latest *planner* report for `github.*` when the ops report is stale and for `costToday`/`pausedReason` always —
     those read `unknown`/absent between the Planner's own reports. Consequence of "send nothing else", not a
     defect; `snapshot.paused` comes from `pauses`. Possible follow-up: snapshot takes each field from the latest
     report that carries it.
  4. Drizzle symbol `healthReports` ↔ SQLite table **`health`**.

- **Leads must write issue bodies and reviews to unique scratchpad files** (2026-09-06 09:30, cost two
  Codex runs): two leads used the same file name in the shared scratchpad; the launcher issue (#116) was filed
  with the chains pak body, its Codex task implemented the wrong unit on branch `codex/planner-launcher` (PR
  #117, "Closes #116"), and Wake routed everything to the wrong quest. Rule: `<scratchpad>/<quest>-<unit>.md`,
  read the body/marker/Closes line back from GitHub after filing, and name the branch in the Codex prompt.
  Planner: put this in every lead brief.

- **Never post to the live `/api/notify` (or call `pak_notify`) from a verification run** (2026-09-06: a lead's
  last smoke check sent a junk "x / y" push to Dru's phone). Scratch servers must leave `NTFY_URL` unset; the
  live notifier is for a pause, a new Rumble, or a demo ready — nothing else. Lead briefs must say so.

- **Quest `planner-in-pak` "Planner inside the Pak" — DECIDED 2026-09-06 08:14: "Move the Planner into the Pak". Lead spawned 08:16 (units 1 host + 2 launcher; it waits for #102 to merge before touching `factory/wake`). Rumble `planner-token` is **Done (08:27)**: Dru pasted the `claude setup-token` token into a chain and asked the Planner to install it; the Planner appended `CLAUDE_CODE_OAUTH_TOKEN=` to `.factory/env` (mode 600) at his explicit request — the only sanctioned exception to POLICIES "never touch `.factory/env`" — and redacted the token from `chain_messages`/`events` in `.factory/pak.sqlite` with sqlite3. The host inherits it via `set -a; . .factory/env`. `unattended-restart` stays parked as superseded; close it when the host ships. **Cutover executed 2026-09-06 ~09:58 by the CLI session** (`tmux respawn-window -k -t wyld:planner` with the launcher's host command line) after telling Dru; the host started a fresh session. History of the decision (2026-09-06 08:15, corrected):** Dru asked whether to move the Planner into the Pak via the Claude Agent SDK. **First answer was
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
  - **Unit 2 landed 2026-09-06 09:50 — #120 / PR #121** (one fix round). `scripts/factory-up.sh` gained
    `PLANNER_MODE` (**`host` is the default**, `cli` is the fallback kept working for a week; anything else exits
    1); host mode builds `@wyld/wake... --filter @wyld/planner-host...` before opening the window and prints
    `Planner mode: <mode>`. `scripts/factory-doctor.sh` checks `PLANNER_HOST_PORT` (8789) in its port loop, adds a
    `planner` detail branch printing `sessionId=… restarts=…`, and reports **exactly one Planner** across four
    cases, failing on both-or-neither. `factory/env.example` documents `PLANNER_MODE`, `PLANNER_HOST_PORT`,
    `CLAUDE_CODE_OAUTH_TOKEN` (empty ⇒ the machine's own `claude` login, the normal case) and
    `.factory/planner-session.json`. `factory-down.sh` untouched.
    - **Sharp edge, cost a fix round and worth remembering: `pgrep -f` cannot find the CLI Planner.**
      Claude Code **rewrites its own process title to its version string** — the live planner pane shows as
      `2.1.261`, so `--dangerously-load-development-channels` appears in no command line at all. The first
      implementation used `pgrep -f '[d]angerously-load-development-channels'`, which made `cli_running`
      permanently false: the doctor cried "no Planner is running" about the Planner that was running, and the
      `host && cli` branch — the whole reason the check exists — was unreachable dead code. The fix is to read the
      launch command from tmux, which keeps it: `tmux list-panes -t wyld:planner -F '#{pane_dead} #{pane_start_command}'`
      filtered with `awk '$1 == 0'`. **Never identify a `claude` process by its command line.**
    - Verified live, read-only, against the running factory: the doctor reports
      `Planner is running as the CLI session (PLANNER_MODE=cli fallback)`, and standing a fake `{ok:true}` health
      endpoint on 8789 while the CLI Planner ran made the two-Planner branch fire correctly.
    - **The cutover has not happened and is Dru's to make.** Note that `PLANNER_MODE` defaults to `host` and the
      live `.factory/env` does not set it, so **the next `pnpm factory:up` starts the host, not the CLI** — set
      `PLANNER_MODE=cli` in `.factory/env` to stay on the old path. The exact window command the launcher uses:
      `set -a; . .factory/env; set +a; until node factory/planner-host/dist/main.js; do echo 'planner host exited; restarting in 5s'; sleep 5; done`
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
  - **Unit 3 (wake) is DONE — #115 / PR #118, merged and deployed 2026-09-06 09:36, no fix rounds.**
    `pak_send_message` gained `kind` (`question` | `message`, default `message`; `rumble` is rejected
    — a Rumble is still raised with `pak_request_rumble`), and `pak_read_chains` gained `kind`
    (`question`/`message`/`rumble`/`all`) and `include_snoozed`. A no-argument `pak_read_chains` still
    requests exactly `/api/chains`, so nothing the Planner already does changed. **No snooze tool was
    added, deliberately** — snoozing is Dru's action in the Pak, and the Planner must never snooze a
    chain. Deployed with `pnpm --filter @wyld/wake build`; the adapter hot-reloads, no restart.
  - **Two leads sharing one scratchpad directory collided on filenames (2026-09-06 ~09:30) and it
    cost a whole duplicate PR.** Both this lead and the `planner-in-pak` lead wrote their issue body
    to a generically-named file in the same scratchpad; the second write won, so the Codex prompt for
    *this* quest's pak unit (#114) carried the *other* issue's publishing instructions. Result: PR
    #117 contained this quest's `factory/pak` work but was pushed to `codex/planner-launcher` with
    `Closes #116`, while the intended task also produced PR #119 on `codex/chains-pak` with
    `Closes #114`. #119 was kept (green, correct branch and marker, and it updated the Pak unit tests
    that #117 left failing); #117 was closed and its branch deleted; #116 was closed as a duplicate.
    **Rule for every lead from now on: name every issue-body and review file after the quest and unit
    (`<scratchpad>/<quest>-unit-<n>.md`), and after filing, read the `Closes` line and the
    `<!-- quest: -->` marker back from GitHub before starting Codex.** Cheap to do, and the failure is
    invisible until two PRs exist for one issue.
  - **Unit 2 (pak) is DONE — #114 / PR #119, merged and deployed 2026-09-06 09:55, two fix rounds.**
    Today's always-visible box is gone: a 56px floating `+` bottom-right opens a composer (bottom
    sheet on a phone docked flush above the nav, popover on desktop). Chain cards carry a kind badge,
    a Snooze button with the three presets, and the Reddit-style fold-up (`N earlier messages` when a
    chain has more than two messages, keeping the last two, re-folding on send). Open Rumbles now
    appear on Today as decidable cards; the Rumble screen reads
    `?kind=rumble&status=all&includeSnoozed=1` and its "Ask for more" posts onto the Rumble's own
    chain instead of opening a side chain. `DecisionButtons` moved to its own component and `Button`
    now forwards refs. **The Playwright suite passes with no spec edits.**
  - **The trick that let Today lose its textarea without touching a spec.** `today.spec.ts` and
    `catchup.spec.ts` assert `getByText("What's on your mind?")` is *visible*, and `today.spec.ts`
    plus `chains.spec.ts` `fill()` + `press('Enter')` on `getByLabel("What's on your mind?")` — so the
    field could not simply be conditionally rendered. The composer form is therefore **always
    mounted**, wrapped in `sr-only` when closed (Playwright counts a 1×1 clipped element as visible
    and will happily fill it), and **`onFocus` on the textarea opens the composer** — so `fill()`
    focuses the field, the sheet opens for real, and the spec exercises the real path rather than a
    hidden one. It is also genuinely better for a screen reader. **Exactly one element may carry that
    accessible name**: the floating button and the dialog are both named `New message`, because a
    second element with the same name makes `getByLabel` ambiguous and fails all three specs under
    strict mode.
  - **Both fix rounds were things only a running browser showed**, invisible to typecheck, lint,
    tests and CI — the pattern this repo keeps re-learning:
    1. **A scrim the same colour as the page dims nothing.** `bg-background/70` over `background` is
       a no-op; the open sheet just looked like it was overlapping the card underneath. Needs an
       actual dim (`bg-black/60 backdrop-blur-sm`).
    2. **The floating button sat on top of the sheet's Close button** at 375px (button y 660–716
       inside a sheet at 500–724), and the sheet left a 35px strip of page showing between itself and
       the nav. Docked it to `bottom-[calc(53px+env(safe-area-inset-bottom))]` — the nav's own height,
       not a flattened `bottom-0`.
    3. **`visibility: hidden` elements cannot take focus**, so hiding the button with `invisible` and
       calling `.focus()` on it in the same handler silently left focus in the now-hidden textarea —
       a keyboard user pressing Escape was trapped in an invisible input. Fixed by moving focus into
       a `useEffect` keyed on the open state (effects run after the DOM updates), with a
       `wasOpened` ref so the page does not steal focus on mount. **Rule: never call `.focus()` on an
       element in the same handler that makes it visible.**
    4. A hard-coded `rumble` string in the decided-Rumble badge, where the open cards correctly
       rendered `{rumble.kind}` — the decided list read `RUMBLE` for everything instead of
       `TASTE`/`ACCOUNT`. Only caught by reading the rendered badges out of the live DOM.
  - **How the UI was actually verified, with no browser extension available:** a throwaway
    `node` script in `factory/pak` importing `@playwright/test`'s `chromium` directly (it must live
    inside that package to resolve the import), pointed at a scratch server, taking full-page
    screenshots at 375×812 and 1280×900 *and* measuring the things the acceptance criteria name —
    `scrollWidth - clientWidth` for horizontal overflow, bounding boxes for the button-vs-nav overlap,
    every `button`/`a[href]` under 44px, `document.activeElement.id` after open and after Escape. That
    measurement caught three of the six defects on its own, and is far more reliable than looking at a
    screenshot. Worth reusing on any Pak unit.
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

## M1 lead — sharp edges (2026-09-07 15:15)

- `pak_register_demo ref=` needs the **full 40-char sha**; the builder does `git fetch origin -- <sha>` and a short ref fails.
- `creatureCalled` fires world-wide (audio gated at 60 m, the event is not) — M2 observation must range-filter at 25 m. Relayed to M2 lead.
- `__wyld.screenshot()` is WebGL-only; DOM HUD/book/toasts never appear. Verify DOM via probe queries or Playwright page screenshot.
- Spawn cap (24) fills in `world.json` region order → distant regions can starve the player's region. Fix = spawn unit, not M2.
- Debug-spawned creatures wander; a Steady one drifts into the 8 m escalation radius. Prefer wild spawns for identification checks.
- Aggro creatures follow the player; the bark hold never released until unit 4 fixed it.
- Ash Fields is bare (props density) — night Sweep candidate if headroom.
- Codex 25–30 min/round all afternoon; chain wait loops to the 30-min cap.
- Thin tests 3× in M1 (files added, listed cases omitted) → **count acceptance cases vs `it(` blocks first.**
- Reusable probe harness: `/tmp/wyld-probe.mjs`.
- Status: `fw-m1-creatures` demo, disc ready at `90d3363`, card registered. Next action + Catch-Up (1261→1472) rewritten.

## M3 brief pre-written (2026-09-07 15:35)

- `/tmp/wyld-leads/fw-m3/brief.md` — Combat in four units: resolve+party / encounter+wild AI / active creature+swap+HUD+driven-off / downed+bond+capture. Branches `codex/fw-m3-resolve|encounter|party|bond`; disc `fw-m3-combat`; marker `<!-- quest:fw-m3-combat -->`. Spawn the lead when M2's disc is ready (both touch `game/`; `observe.ts`'s placeholder `creatureExecutedMove` is M3 unit 2's seam).
- M2 status: #210/#211 notebook unit open (Codex ~10 min), lead reviewing.

## M2 progress (2026-09-07 16:30)

- Units 1–2 merged (#211 notebook, one typecheck fix round; #213 tracks/observe/toasts, one fix round). Unit 3 (the book, #214) with Codex. Each unit ≈ 25–45 min end to end; Codex ~10–17 min/round this hour.
- Lead's review of #213 caught: a vacuous `every([])` test hiding zero Pyreclaw decals (Crater Rim has no cover props → chord fallback); aggro faking `creatureCalled` into the verified event stream (now `onCreatureAggro`, 25 m gate, both aggro paths); **one Mesh per decal doubled draw calls** (Hollow Camp 37→78) → instanced. Rule for M3: projectiles/decals must be instanced or pooled; leads measure draw calls at the three camps against `main`.
- M2 explainer drafted at `/tmp/wyld-leads/artifacts/explainer-fw-m2.html` (interactive stub→merge, hint rules, Index, fog) and listed in `publish.mjs`; smoke-tested headless, no errors. Publish + roadmap v8 (M2 landed / M3 now) when the quest reaches `demo`.

## Open: controls decision gates M3 (2026-09-07 16:50)

- Dru's feedback on Creatures exist: tap-to-move (mobile), same tap directs creatures ("toggle between them and tap"; creature picks its own path). Rumble `controls-tap-to-move` (taste) raised, blocking `fw-m3-combat`; replied on the quest card.
- **Do not spawn the M3 lead until it's chosen.** If option 1/2: a `controls-tap-to-move` quest (~2 units: ground tap/drag + pathing that respects water/slope + drag-orbit camera + crouch/sprint toggles + tap-to-target; touch HUD incl. a console button) runs **before** M3, and the M3 brief's key bindings (1/2/3, Tab, hold-E) become taps/holds. Option 3: spawn M3 as briefed.
- Try-it steps for M0/M1 are keyboard-written; rewrite when the controls change.
- Brief for the tap-to-move quest pre-written at `/tmp/wyld-leads/controls/brief.md` (2 units: pathing+tap/drag; touch HUD+console). Fill in the chosen option line before spawning. Runs after M2 completes (touches `game/`).

## Two leads in parallel (2026-09-07 16:50)

- **M2 lead** (game/): unit 3 book, fix round 1 running. Told to put interim summary/steps on every disc re-register and to add a controls helper (§12 overlay + `?`) — Dru asked.
- **demo-player lead** (factory/ only, quest `one-mechanism`): `/demos/:id` iframes `/play/<id>/` for any kind → JSON error on a live card. Fix: redirect non-disc demos to `deepLink`/`url`; mechanical Catch-Up emits `/demos/<id>` only for discs. **My own Catch-Ups did this too** — rule: `/demos/<slug>` only for discs; live cards use their deep link. Catch-Up 1261→1524 rewritten with the fix and the controls Rumble.
- Dru's feedback answered on both quest cards (chains 89, 90).
- Roadmap v8 published (16:55): lanes rewritten as **outcomes** ("what will be true when done") per Dru's pin (chain 91); field guide in Now, controls + Combat + Training in Next, gates/rares/ship in Later; meters honest (4/4 biomes, 13/13 species, 2/8 milestones). Rule: lane entries are outcome sentences, pieces are the units. `publish.mjs` takes `ONLY=<slug>` to publish one artifact (used so the unpublished M2 draft isn't pushed).
- Roadmap v9 (16:50): **Mission block** at the top per Dru — "A core loop that's fun to play, on your phone", the sentence that makes it true, previous mission ("the factory works") crossed off. Rule: the roadmap carries one standing mission; it changes only when the mission does; the Now/Next lanes are what make it true.
- **Decision 16:49: tap to move everywhere, now.** Quest `controls-tap-to-move` created (planning); brief filled in; M3 brief re-keyed to taps/holds. Order in `game/`: M2 units 3–4 → controls (2 units) → M3. Spawn the controls lead when the M2 disc is ready. M3 likely starts after tonight's Sleep Mode.
- **16:52 Dru's control model (chain 88):** no sprint/crouch ("tactical shooter"); tap ground → selected thing walks; tap your creature → select; tap yourself → back; selected creature's moves are buttons, tap = use from wherever it is. Stealth = cover + approach direction + still is silent (moving = 8 m). Controls brief now **3 units** (tap/drag + stances removed; Barrow in the world + select/send; thumb HUD + move buttons + console + helper). M3 brief re-keyed (buttons, party-card tap, hold on creature, auto-target rule). Assumed default, told Dru: one creature out at a time. Roadmap v11.
- 16:56 Dru (chain 92, `artifacts`): hold ⌘ = pin mode, ⌘-click pins, release = pointer; bottom scroll clipping in the explainer viewer. Handed to the demo-player lead as a follow-on issue (`codex/artifacts-cmd-pin`) after #216 — one Pak lead at a time. If `PIN_BRIDGE_SNIPPET` changes, republish all explainers with `--force`. Tell Dru on chain 92 when live.
- 16:56 Dru: **all three party creatures out at once** — no active creature, no swap, no 2 s gap. Selected creature acts on the buttons; unselected hold and don't attack (my stated default); wild targets nearest owned; driven off when all down. Both briefs updated. Spec §7.1/§7.5/§11 superseded on these points — note it in the M3 issue bodies.
- 16:58 Dru (chain 93): isometric/top-down instead of third-person 3D? Rumble `view-isometric` (taste) raised, blocking `controls-tap-to-move` + `fw-m3-combat`. **Don't spawn the controls lead until chosen.** If option 1 (fixed iso camera): controls unit 1 = pathing + screen-space tap + fixed camera (orthographic or fixed-pitch perspective ~35–50°, yaw fixed, no orbit; shadows/culling retuned; identification "in frustum" → "on screen"); drop drag-orbit; zoom optional. If option 2: a new quest before controls (rooms/screens, spawn per room, map = rooms) — write a brief then. Option 3: as briefed.
