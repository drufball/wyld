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

