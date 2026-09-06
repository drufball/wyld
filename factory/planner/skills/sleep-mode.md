# Skill — Sleep Mode (the night shift)

Use when a `sleep.alarm` arrives (PROTOCOL §2). The server owns the clock — GOODNIGHT or 23:00
starts a run, 07:15 is last call, 08:00 is lights on and the server tidies up by itself if you have
not. You own what happens in between. `pak_read_sleep` shows the run, its schedule and the phases
you have recorded so far; every phase you enter is recorded with `pak_advance_sleep` so the Sleep
screen stays honest.

Guarantees you are working towards (factory-spec §8): no open non-draft PR at 08:00; every leftover
has a one-line note on its quest; a retro exists even if the night went badly; Today is clean and
the next action is set when Dru wakes up.

## On `goodnight`

1. `pak_read_sleep` → note the `runId` and `lightsOnAt`. Post one note on nothing — this is not a
   quest — just carry on. Do **not** send a push.
2. `pak_advance_sleep run=<id> phase=drain`.

## Phases, in order

**1. Drain** — finish or park everything in flight. `gh pr list`; for each open Codex PR: green and
reviewed → merge and ship (merge-and-ship.md); nearly there → one fix round; can't land tonight →
`gh pr ready --undo <n>` (draft) and a one-sentence `pak_post_note` on its quest saying why and
what would land it. Leads mid-flight: wait for the merge boundary, then stop them. Nothing new is
started in Drain.

**2. Sweep** — `pak_advance_sleep phase=sweep`. Code health only, no behaviour Dru would notice:
dependency bumps that pass CI, dead code, lint debt, duplicate logic. File each as a Codex issue with
title prefix `night:` through a lead as usual (one issue, one task, review, merge only if green).
Small by POLICIES §5 #9 (< ~1h Codex); anything bigger becomes an `idea` quest, not a night issue.
If nothing is worth sweeping, say so in the retro and move on — an empty Sweep is fine.

**3. QA** — `pak_advance_sleep phase=qa`. `pnpm smoke` on `main` (isolated from the live factory);
`pak_read_demos` — every disc should read built cleanly; rebuild the main disc if it is stale.
Problems become quests (`idea`) with a friend-pitch, never silent fixes.

**4. Retro** — `pak_advance_sleep phase=retro`, then `skills/write-retro.md`.

**5. Reset** — `pak_advance_sleep phase=reset`. Close chains that are genuinely settled (never one
Dru is still in). Write the morning Catch-Up (`skills/write-catchup.md`; the night's outcome is an
`fyi` line). Set the one next action. Then `pak_end_sleep run=<id> outcome=clean
leftovers_parked=[…]` and go quiet.

## On `last_call` (07:15)

Whatever phase you are in: stop starting things. Finish the current merge if it is green, park the
rest with notes, write the retro if it is not written, do Reset, end the run. Forty-five minutes is
plenty for that and for nothing else.

## On `lights_on` (08:00)

If the run is still open, `pak_end_sleep outcome=timed_out` yourself and make sure the retro is
yours (the server writes a mechanical stub when it has to end the run; overwrite it with
`pak_write_retro`). Then Reset, in miniature: Catch-Up + next action. Go quiet. Nothing else
starts before Dru's day does — from here you are back on the normal event loop.

## If the factory pauses during the night

`system.paused` wins. Park what is in flight with notes, `pak_end_sleep outcome=paused`, write the
retro anyway (the pause is a miss), and let the pause runbook take it from there.

## Never

- Never start a Codex task after last call.
- Never push to Dru's phone from the night shift; the morning Catch-Up is the report.
- Never leave a non-draft PR open at 08:00, and never merge red to make one go away.
