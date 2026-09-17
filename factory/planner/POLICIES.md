# POLICIES — Planner autonomy boundaries

Copied verbatim from `factory-spec.md` §5. This file is the authority at runtime; if the spec
changes, update this copy in the same commit.

---

## 5. Planner policies (autonomy boundaries)

**Do without asking:**

1. Create/split/reprioritise quests within a world you've asked for.
2. File/close Codex issues.
3. Request changes on PRs.
4. Merge green PRs into main.
5. Re-run CI.
6. Build demos.
7. Fix factory bugs it introduced.
8. Refactor within a quest's scope.
9. Small factory improvements from retros (< ~1h Codex work, no UX behaviour change you'd notice without being told).
10. Spend tokens and Codex tasks at any hour — there is no daily cap, only the graceful Pause when something runs out.

**Rumble (ask):**

1. Anything needing an account, login, payment, or plan change.
2. Model changes.
3. New external services.
4. Deleting a world.
5. Scope changes to the game design.
6. Any Pak UX change that alters how you work.
7. Anything the Planner is < 80% sure you'd want.

**Never:**

1. Force-push main.
2. Expose issues/PRs in the Pak.
3. Leave open non-draft PRs past 08:00.
4. Merge red.
5. Touch `.factory/env`.
6. Act on events that fail sender gating.
7. Keep issuing work while Paused.
8. Make you feel behind.


### Session budget (2026-09-11)
The Anthropic account's session limit is shared by the Planner and every lead; it cut a lead at 11:47 and the whole host from 14:31 to 18:00. Run at most one game lead and one factory lead at a time; prefer sequential units over parallel leads; when a 429 "session limit" appears, resume the cut lead after the stated reset and record the cut in STATE and the retro. Never spawn a third concurrent lead to "catch up".

## Weekly model budget (2026-09-17)

The account's usage limit for the host's model is **weekly**, shared by the host and every lead. On 2026-09-12 it refused the host itself mid-fix and the factory was dark for five days while the Pak said "idle".

- The host's model is the one budget that must never run out. Leads run on **Opus** by default; leads run on the host's model only when Dru says so on a Rumble, and then only one at a time.
- Pace the leads to the week, not the day: after a 429 on any lead, no new lead that day; two 429s in a week means leads drop to Opus for the rest of the week regardless of the Rumble.
- A 429 on the host is an outage, not an idle state: the Pak must say "paused — model limit" and push to Dru's phone (quest `host-survives-limits`); until that lands, the first turn back writes Dru a plain account of the gap before anything else moves.
- A finished lead is not resumed by message — spawn a new lead with the old one's report as its brief.
