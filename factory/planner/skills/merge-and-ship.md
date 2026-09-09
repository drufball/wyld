# Skill — merge and ship

Use on `github.ci_completed` when the check suite is green and the review has passed.

## 1. Confirm, then merge

```bash
gh pr checks <n>          # must show: ci  pass
gh pr merge <n> --squash --delete-branch
```

Never merge red. Never merge a diff you have not read. Never force-push `main`.
There is no branch protection on this repo — nothing server-side will stop you (`PROTOCOL.md` §6).

If CI is red instead: read the failing job's log, then run **one** fix round on the branch
(`review-pr.md` step 5). Do not start a second Codex task for the issue.

## 2. Deploy to the live factory

Merging is not shipping — Dru sees the *built* Pak, not `main`. In the live checkout
(`/Users/crawnk/wyld`), after every merge:

```bash
git -C /Users/crawnk/wyld pull
# added or renamed a workspace package (packages/*)?  → install FIRST, before anything restarts the
# server, or the tsx watcher restarts into ERR_MODULE_NOT_FOUND and the Pak goes dark (2026-09-07,
# @wyld/sprites: ~1 minute down). Then check the link exists:
pnpm install --frozen-lockfile && ls factory/server/node_modules/@wyld/
# touched @wyld/shared (or any package the server imports)?  → rebuild it or the live server crashes
# on its watcher restart:
pnpm --filter @wyld/shared build
# touched @wyld/shared or factory/server?  → ALSO rebuild the server's dist. The live server runs
# from src via tsx, but the smoke suite boots factory/server/dist — a stale dist fails smoke on an
# import that no longer exists, silently, until someone runs it (2026-09-08: dist was a day old).
pnpm --filter "@wyld/server..." build
# touched factory/pak?   → rebuild the served bundle or Dru keeps seeing the old UI:
pnpm --filter @wyld/pak build
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8787/api/events?limit=1"   # expect 200
```

Verify a deploy with reads (`GET`), never by writing as Dru: closing, settling or dismissing a
chain through the API writes a `human.*` event he never made (2026-09-08, a lead dismissed a
briefing "as read" — it landed in his event stream as his own dismissal). Leads verify by reading;
only the Planner writes to chains, and only as itself.

Skipping the Pak rebuild is how "the flatten merged but Dru still saw the Worlds tab" happened
(2026-09-05). Then clean up: `git worktree remove <scratchpad>/wt-<slug>` if you made one. The
issue closes itself via `Closes #N` in the PR body; if it did not, close it by hand.

## 3. Update the quest

```bash
pak_link_issue  quest=<id> gh_kind=pr    gh_ref=<n> state=merged   # progress derives from this
pak_link_issue  quest=<id> gh_kind=issue gh_ref=<N> state=closed   # the issue `Closes #N` shut — record that too,
                                                                   # or the quest sits at 0.8 forever (seen twice, 2026-09-06)
```

Then move the quest, per `PROTOCOL.md` §1:

- More units still open → stays `building`.
- Last unit merged, something runnable exists → `demo`, **and register its try-it card** (below).
- Last unit merged, nothing to try → `done`.

### Every quest reaching `demo` updates its explainer and asks for a look (Dru's rule, 2026-09-08 — supersedes the try-it card)

The try-it card is retired (quest `explainers-embed-demos`). When a quest reaches `demo`: (1) update its explainer with the live demo **embedded** (a game build via `?scenario=…`, or the Pak screen itself) and the steps as prose beside it; (2) post one chain on the quest, in the field-notes voice, asking Dru to look, with a link to the explainer; (3) feedback arrives as pins on the embedded demo (screenshot + game state attached) — answer each pin in its chain. Until the embed lands, keep registering the disc so the build exists, but the card is not the thing Dru is sent to. The older rule follows for reference:

### (retired) Every quest reaching `demo` gets a try-it card (Dru's rule, 2026-09-06)

A card is what Dru sees on the Demos screen and behind the quest card's Try it button: what changed at a
glance, numbered steps to try it, and the test data you put in place. Register it with the same
tool that registers a game disc:

```bash
# factory / Pak change — tried against the live Pak (the default):
pak_register_demo  slug=<questId> kind=live ref=<merge sha> quest=<questId> \
                   summary="<1–2 sentences: what changed, in his words>" \
                   steps='["Open …", "Tap …", "You should see …"]' \
                   seeded='["<what you put there for him to find>"]' \
                   deep_link=/<screen where step 1 starts>
# game change — a Demo Disc, as before:
pak_register_demo  slug=<questId> ref=<branch or sha> quest=<questId>
```

- **Seed first, then register.** Put the sample data in through the live API (`localhost:8787/api/...`)
  before the card exists, so step 1 works the moment he taps. Never seed anything destructive, and
  never through a scratch server — the card points at the live Pak.
- Steps are things *he* does, one action each, in order, ending with what he should see. No
  GitHub numbers, branches or CI words anywhere on the card.
- Re-registering the same slug updates the card in place — do that when a follow-up round changes
  what he'd see.
- **Branch build first** (kind `pak`, once unit 4 of `try-it-cards` ships) for big or risky factory
  changes, or anything that alters how Dru works: register the branch build before merging, let him
  try it, then land it and re-register as `live`. The Planner picks per quest.

```bash
pak_set_quest_status      quest=<id> status=<next>
pak_post_note             quest=<id> text="<what he can now do that he couldn't before>"
pak_set_since_you_looked  quest=<id> text="…"
```

## 4. Set the one next action

```bash
pak_set_next_action text="…" deep_link=/worlds/<worldId>
```

Exactly one, always a thing **he** does, always with a deep link (`PROTOCOL.md` §4). If nothing
needs him, say so plainly and point at `/`.

## 5. Then keep going

A project lead reports at each unit boundary **and keeps going** — it does not end its turn and
wait to be sent back in (2026-09-07: a lead stopped after unit 1 while its unit-2 Codex round was
already running). Briefs say so explicitly; if a lead has ended anyway, the Planner resumes it with
a message rather than spawning a fresh one, so its context survives.

Pick up the next unit of work without being asked (`POLICIES.md`: file issues, merge green PRs,
spend at any hour). Going quiet is for when there is nothing to do, not for when a PR just merged.

### Leave no loops behind (2026-09-09)
The always-on Mac ran at load 35 for a day and a half: six `for j in 1..6; do (while …` background loops from a lead's bootstrap script and twelve orphaned `zsh -c` tool shells, ~1200% CPU on 12 cores. Every build and headless check ran on a starved machine. Before a lead reports: `pgrep -fl "while|playwright|node -e"` and kill anything you started; never use `&` loops in a tool shell without a bounded exit; the Planner checks `uptime` load at Drain and kills orphans (`ppid 1`, `shell-snapshots/snapshot-zsh`) on sight.

### Disc builds want the full commit id (2026-09-09)
`pak_build_disc` / `pak_register_demo` with an abbreviated sha fails inside the builder (`couldn't find remote ref`) and leaves the disc `failed` — all three discs went red one night before anyone noticed. Always pass the 40-character sha (`git rev-parse HEAD`), keep each disc's deep link (fw-arena `/?scenario=arena`, fw-diorama `/?look=diorama`), and read `/api/demos` afterwards until `ready`.
