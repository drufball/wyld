# PROTOCOL — v0 (placeholder)

> This is the essentials-only v0 written during Phase 0. The full v1 (what every Wake event means
> and exactly what to do about it) lands in step 1.3. Do not treat gaps here as permission; when
> unsure, check `POLICIES.md`.

## Quest lifecycle

A **Quest** is a shippable chunk of functionality Dru would recognise and could try.

```
idea ──► planning ──► building ──► demo ──► done
  │          │            │          │
  └──────────┴────────────┴──────────┴────► parked
```

| Status | Means | Planner's job |
|---|---|---|
| `idea` | Captured, not yet broken down. Usually from a `human.intent` event. | Write the one-line pitch. Ask a clarifying question only if genuinely ambiguous. |
| `planning` | Being broken into Codex-sized units. | Decide the sequence; file the first issue. |
| `building` | One or more Codex issues/PRs open. | Review PRs, request changes, merge green, keep `since_you_looked` current. |
| `demo` | Something is built and runnable. | Register the Demo Disc; watch for `human.feedback`. |
| `done` | Merged, demoed, no follow-ups. | Save-chime. Record it in the day's retro. |
| `parked` | Blocked (Rumble pending) or deliberately shelved. | One plain-English note saying why and what would unpark it. Route around it and keep building. |

Quest ↔ issue/PR links live in `quest_links` and are **never rendered in the Pak**.

## The Codex loop

```
Planner files issue (@codex, quest marker)
        │
        ▼
Codex opens PR ──► CI runs ──► webhook ──► Wake ──► Planner
        │                                              │
        │◄──── "@codex <feedback>" PR comment ◄────────┤ review: read the whole diff,
        │                                              │ check CI + acceptance criteria
        ▼                                              │
   Codex pushes fix ──► CI green ─────────────────────►┘
        │
        ▼
Planner squash-merges (gh pr merge --squash --delete-branch)
        │
        ▼
Quest updated in the Pak · next action refreshed
```

Rules:

1. One issue = one coherent unit Codex can finish in roughly an hour. Explicit acceptance criteria
   and the exact verify commands, every time.
2. Sequence dependent issues — Codex works off `main`, so do not file B until A is merged.
   Independent issues may be filed in parallel.
3. Never merge red. Never merge without reading the diff. Do not nitpick what the linter enforces.
4. After any batch of actions, refresh each affected quest's "since you last looked" line and the
   single recommended next action.

## Event handling (v0)

Events arrive from Wake as `{source, kind, quest?, issue?, pr?, url?, summary, ts}`.

- `human.intent` → create or update a quest; reply as a `planner.note`.
- `human.feedback` → ack on the quest card; turn into work or a follow-up quest.
- `human.decision` → record the Rumble choice; unpark whatever it unblocked.
- `github.pr_opened` / `github.pr_synced` → review when CI has finished.
- `github.ci_completed` → merge if green and the review passed; otherwise comment `@codex`.
- `system.paused` → stop issuing work, park in-flight items with notes, keep the Pak honest.

Loop shape: receive event → classify → act → update the Pak → go quiet.
