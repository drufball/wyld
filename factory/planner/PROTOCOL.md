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

Codex is driven **from the Codex CLI**, not from `@codex` GitHub mentions. A task triggered by a
GitHub mention runs with `environment_id: null` and no environment, so it never sees `GH_TOKEN` and
can never push. The Planner drives Codex Cloud directly, pulls the diff back, and publishes it.

Always invoke the CLI through `npx -y @openai/codex@latest` — never install it globally, and never
use a locally installed `codex` binary (0.44 is too old for the `cloud` subcommands). Auth is the
existing ChatGPT login.

```
Planner files the GitHub issue (tracking; its body is also the prompt)
        │
        ▼
codex cloud exec --env drufball/wyld --branch main "<prompt>"   ──►  task_e_...
        │
        ▼
poll: codex cloud status <task_id>   (every 60s, cap 30 min)
        │
        ▼
worktree + fresh branch codex/<slug> off origin/main
codex cloud diff <task_id> | git apply
verify: ./scripts/bootstrap.sh && pnpm typecheck && pnpm lint && pnpm test && pnpm build
commit --author="Codex <codex@openai.com>" · push · gh pr create --base main
        │
        ▼
Planner reviews the whole diff as a senior engineer
        │
        ├── changes needed ──► codex cloud exec --branch codex/<slug> "<review feedback>"
        │                      apply the new diff on top, push  ──┐
        │                                                          │
        └── green & good ◄────────────────────────────────────────┘
        │
        ▼
gh pr merge <n> --squash --delete-branch
```

### Commands

| Command | What it does |
|---|---|
| `npx -y @openai/codex@latest cloud exec --env drufball/wyld --branch <branch> "<prompt>"` | Starts a task; prints a URL containing the `task_e_...` id. `--env` takes the environment **label**. |
| `... cloud status <task_id>` | Task state; `ready` means finished. |
| `... cloud list --json --limit <n>` | Recent tasks: `id`, `status`, `summary.files_changed`, `environment_label`. |
| `... cloud diff <task_id>` | The unified diff on stdout. |
| `... cloud apply <task_id>` | Applies that diff to the local working tree. |

### Rules

1. **One `cloud exec` task per issue.** The prompt is the issue body, prefixed with: "Implement
   GitHub issue #N of drufball/wyld. Follow AGENTS.md. Do NOT attempt to push or open a PR; just
   make the changes, run the verification commands, and summarize."
2. One issue = one coherent unit Codex can finish in roughly an hour. Explicit acceptance criteria
   and the exact verify commands, every time.
3. **Codex never publishes.** The Planner applies the diff, verifies locally, commits authored as
   `Codex <codex@openai.com>`, pushes, and opens the PR. The commit message carries
   `Closes #<issue>` and the PR body follows the `AGENTS.md` format, including the Codex task URL.
4. **Apply in a git worktree**, never in the main checkout:
   `git worktree add -b codex/<slug> <scratchpad>/wt-<slug> origin/main`. Remove it when the PR
   merges (`git worktree remove`).
5. Verify locally before pushing — all four of `typecheck`, `lint`, `test`, `build`, plus
   `./scripts/bootstrap.sh`. Never push a diff you have not run.
6. **Review-fix loop runs on the PR branch**: `cloud exec --branch codex/<slug>` with the review
   feedback as the prompt, then apply the returned diff on top of the branch and push. Same PR, no
   second PR.
7. Sequence dependent issues — Codex works off the named branch, so do not start B until A is
   merged. Independent issues may run in parallel.
8. Never merge red. Never merge without reading the whole diff. Do not nitpick what the linter
   enforces.
9. After any batch of actions, refresh each affected quest's "since you last looked" line and the
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
