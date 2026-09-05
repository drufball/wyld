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
can never push — **never use `@codex` mentions on GitHub.** Instead the Planner starts a Codex Cloud
task with an explicit environment, and inside that environment `GH_TOKEN` is a non-empty env var, so
Codex publishes its own work: it pushes a `codex/<slug>` branch and opens the PR itself (see
`AGENTS.md` → "Publishing your work").

Always invoke the CLI through `npx -y @openai/codex@latest` — never install it globally, and never
use a locally installed `codex` binary (0.44 is too old for the `cloud` subcommands). Auth is the
existing ChatGPT login.

**Always pass `--env 6a9be268ad288191b44bbdefcbe977ee` — the environment ID, never the label
`drufball/wyld`.** The label resolves to a different environment with no token, which silently
reproduces the "Codex can't push" failure mode this loop exists to avoid.

```
Planner files the GitHub issue (spec is the issue body; the prompt names the issue)
        │
        ▼
codex cloud exec --env 6a9be268ad288191b44bbdefcbe977ee --branch main "<prompt>"  ──► task_e_...
        │
        ▼
wait for the PR: poll `gh pr list` every 60s (cap 30 min); `codex cloud status <task_id>` for
task state. Typical latency: 4–8 min for an implementation, 3–4 min for a fix round.
        │
        ▼
Planner reviews the whole diff on the PR as a senior engineer; `gh pr checks` is the truth,
not Codex's self-report
        │
        ├── changes needed ──► gh pr review <n> --request-changes -b "<feedback>"
        │                      codex cloud exec --env <id> --branch codex/<slug> "<feedback>"
        │                      (loops back to "wait for the PR")
        │
        └── green & good ──► gh pr merge <n> --squash --delete-branch
```

### Primary flow: Codex publishes

1. **File the issue.** Body is the spec, in this shape:

   ```
   ## Context
   <why this exists, what it touches>

   ## Task
   <what to build>

   ## Acceptance criteria
   <bullet list, testable>

   ## Verify
   <exact commands: typecheck / lint / test / build / manual steps>

   ## Out of scope
   <what NOT to touch>

   <!-- quest:<id> -->
   ```

2. **Start exactly one task for the issue:**

   ```bash
   codex cloud exec --env 6a9be268ad288191b44bbdefcbe977ee --branch main \
     "Implement GitHub issue #N of drufball/wyld. <body>. Follow AGENTS.md including \
   'Publishing your work': push branch codex/<slug> and open a PR whose body contains 'Closes #N'."
   ```

   One `cloud exec` task per issue — never two triggers for one issue. If a task looks stuck or
   wrong, fix it with a review round on the branch it already opened; do not start a second task
   for the same issue.

3. **Wait for the PR.** Poll in a single loop rather than one-off checks:

   ```bash
   until gh pr list --json number,headRefName,body | grep -q '"codex/'; do sleep 60; done
   ```

   Cap any such loop at 30 minutes. `codex cloud status <task_id>` gives task-level state
   (`ready` means Codex finished its side, independent of whether the PR is open yet). Typical
   latency: 4–8 minutes for an implementation, 3–4 minutes for a fix round.

4. **Review on the PR**, as a senior engineer:
   - Read the whole diff, not just the summary.
   - `gh pr checks <n>` must show green. **Do not trust Codex's self-reported checks — CI is the
     truth.**
   - Acceptance criteria from the issue are actually met.
   - No new globals, no secrets, nothing under `.factory/`.
   - Idiomatic for this codebase; not over-engineered for what the issue asked.
   - When it matters (UI, behaviour a diff can't show), pull the branch into a worktree and verify
     it locally rather than taking the description on faith.

5. **Fix round**, when changes are needed:

   ```bash
   gh pr review <n> --request-changes -b "<review, verbatim>"
   codex cloud exec --env 6a9be268ad288191b44bbdefcbe977ee --branch codex/<slug> \
     "Address the review on PR #M of drufball/wyld: <feedback verbatim>. Commit and push to the \
   same branch; do not open a new PR."
   ```

   **Sharp edge:** `--branch` reads the branch as it exists on GitHub right now. Anything the
   Planner applied locally to that branch must be pushed *before* starting the next task, or Codex
   works off a stale branch.

6. **Merge when green and correct:**

   ```bash
   gh pr merge <n> --squash --delete-branch
   ```

   Never force-push `main`. Never merge red.

### Commands

| Command | What it does |
|---|---|
| `npx -y @openai/codex@latest cloud exec --env 6a9be268ad288191b44bbdefcbe977ee --branch <branch> "<prompt>"` | Starts a task; prints a URL containing the `task_e_...` id. `--env` takes the environment **ID**, never the `drufball/wyld` label. |
| `... cloud status <task_id>` | Task state; `ready` means finished. |
| `... cloud list --json --limit <n>` | Recent tasks: `id`, `status`, `summary.files_changed`, `environment_label`. |
| `gh pr list --json number,headRefName,body` | Poll target for "has Codex opened the PR yet." |
| `gh pr checks <n>` | CI state — the source of truth, not Codex's summary. |
| `gh pr review <n> --request-changes -b "<text>"` | Posts the fix-round review onto the PR. |
| `gh pr merge <n> --squash --delete-branch` | Merges once green and reviewed. |

### Fallback when Codex cannot publish

Use this only when `GH_TOKEN` is missing/expired in the environment, or Codex otherwise cannot
reach GitHub (Codex says so, or no branch/PR appears after a reasonable wait). It is no longer the
default path — do not reach for it just because it was the old habit.

The Planner pulls the diff back and publishes it directly:

```
codex cloud diff <task_id> | git apply           # in a fresh worktree/branch off origin/main
verify: ./scripts/bootstrap.sh && pnpm typecheck && pnpm lint && pnpm test && pnpm build
commit --author="Codex <codex@openai.com>" · push · gh pr create --base main
```

- Apply in a git worktree, never the main checkout:
  `git worktree add -b codex/<slug> <scratchpad>/wt-<slug> origin/main`. Remove it once the PR
  merges (`git worktree remove`).
- Verify locally before pushing — all four of `typecheck`, `lint`, `test`, `build`, plus
  `./scripts/bootstrap.sh`. Never push a diff you have not run.
- Commit message carries `Closes #<issue>`; PR body follows the `AGENTS.md` format, including the
  Codex task URL.
- Review-fix loop still runs on the PR branch: `cloud exec --branch codex/<slug>` with the review
  feedback as the prompt, apply the returned diff on top, push. Same PR, no second PR.

### Rules

1. One `cloud exec` task per issue, ever — whichever flow is in play. Never two triggers for one
   issue.
2. One issue = one coherent unit Codex can finish in roughly an hour. Explicit acceptance criteria
   and the exact verify commands, every time.
3. Sequence dependent issues — Codex works off the named branch, so do not start B until A is
   merged. Independent issues may run in parallel.
4. Never merge red. Never merge without reading the whole diff. Do not nitpick what the linter
   enforces.
5. After any batch of actions, refresh each affected quest's "since you last looked" line and the
   single recommended next action.

### Branch protection (blocked — Rumble pending)

`main` has **no branch protection**, and cannot have any until an account decision is made.
`drufball/wyld` is a private repo on a Free plan, and GitHub gates both mechanisms behind Pro:

```
$ gh api -X PUT repos/drufball/wyld/branches/main/protection ...
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.","status":"403"}
$ gh api -X POST repos/drufball/wyld/rulesets ...
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.","status":"403"}
```

Both ways out — paying for GitHub Pro, or making the repo public — are Rumbles under
`POLICIES.md` ("anything needing an account, login, payment, or plan change"). Until one is
chosen, the required `ci` check is **convention, not enforcement**. So, without exception:

- Never merge a PR whose `gh pr checks <n>` does not show `ci  pass`.
- Never push to `main` directly except for the Planner-owned files listed in `CLAUDE.md`.
- Never force-push `main`. Nothing at the server side will stop you.

When the Rumble resolves in favour of Pro, apply:

```bash
gh api -X PUT repos/drufball/wyld/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["ci"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false
}
JSON
```

The CI check context is named `ci`.

## Known constraints

- **TypeScript is pinned to 6.0.3** because of the `typescript-eslint` peer range — do not bump it
  without also bumping `typescript-eslint` and confirming the peer range is satisfied.

## Event handling (v0)

Events arrive from Wake as `{source, kind, quest?, issue?, pr?, url?, summary, ts}`.

- `human.intent` → create or update a quest; reply as a `planner.note`.
- `human.feedback` → ack on the quest card; turn into work or a follow-up quest.
- `human.decision` → record the Rumble choice; unpark whatever it unblocked.
- `github.pr_opened` / `github.pr_synced` → review when CI has finished.
- `github.ci_completed` → merge if green and the review passed; otherwise comment `@codex`.
- `system.paused` → stop issuing work, park in-flight items with notes, keep the Pak honest.

Loop shape: receive event → classify → act → update the Pak → go quiet.
