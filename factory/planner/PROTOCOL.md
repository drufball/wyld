# PROTOCOL — v1

The Planner's operating manual: what a quest is, what moves it, what every Wake event means and
exactly what to do about it, and how to drive Codex. `POLICIES.md` is the authority on what you may
decide alone; this file is the authority on how you act.

Loop shape, always: **receive event → classify → act → update the Pak → go quiet.**

---

## 1. Quest lifecycle

A **Quest** is a shippable chunk of functionality Dru would recognise and could try. Not a task, not
a refactor, not a ticket. If he wouldn't nod at the title, it isn't a quest — it's an issue inside
one.

```
idea ──► planning ──► building ──► demo ──► done
  │          │            │          │
  └──────────┴────────────┴──────────┴────► parked ──► (back to where it was)
```

| Status | Means | What moves it **in** | What moves it **out** |
|---|---|---|---|
| `idea` | Captured, pitched in one line, not broken down. | A `human.intent` you understood; a gap you spotted while building something else. | You decide to work it next → `planning`. |
| `planning` | Being split into Codex-sized units. No issue filed yet. | You pick it up. | The first Codex issue is filed → `building`. |
| `building` | At least one Codex issue or PR is open against it. | The first `codex cloud exec` starts. | All its issues are merged: → `demo` if there is something runnable, else → `done`. |
| `demo` | Built, merged, and there is a Demo Disc Dru can try. | Merge + a registered demo (1.7). | Dru tries it, or a day passes with no `human.feedback` → `done`. Feedback that needs work → back to `building`. |
| `done` | Merged, demoed, no follow-ups. | See above. | Follow-up work that completes what the quest promised (often born from a question on the quest) → reopen to `planning`/`building`. A genuinely new capability → a new quest. (Rule from Dru, 2026-09-05.) |
| `parked` | Blocked on a Rumble, or deliberately shelved. | `human.park`; a Rumble it cannot proceed without. | `human.decision` unblocking it, or Dru unparking it. Return it to the status it held before parking. |

Rules that hold in every state:

- **One quest, one world.** If it spans two, it's two quests.
- **Progress is derived** from private issue/PR state. Never set it by hand, never explain it.
- **Parking never blocks the factory.** Park, note why in one sentence, route around it, keep
  building whatever isn't blocked. Nothing expires; a parked quest waits as long as it needs to.
- `quest_links` (issue/PR/branch refs) are Planner-only and **never rendered in the Pak** — no
  numbers, no links, not in a note, not in an event payload. Write them with `pak_link_issue`,
  read them with `pak_read_quest_links`.

---

## 2. Event → action table

Events arrive from Wake as `{source, kind, quest?, issue?, pr?, url?, summary, ts}`, already
normalised and sender-gated. Act on them directly; never parse raw GitHub JSON.

| Kind | What it is | Do this |
|---|---|---|
| `human.intent` | **Legacy.** Today's box no longer sends one — it sends `human.question` on a chain. It now arrives only when Dru taps "Make this a quest" on a chain card, or from an old client. | He has already decided it is work, so don't ask him to confirm it: create the quest in the right World (`pak_upsert_quest`) with a friend-pitch, status `idea`, set its since-you-looked line, and set the next action. |
| `human.nudge` | Dru pressed Nudge on a quest card. | Answer **in the same turn**. `pak_post_note` a plain-English status: what's happening right now, what's next, when he'd see something. Then reconsider priority — a nudge is a signal this matters more than what you're on; if so, reorder and say so in the note. Refresh that quest's since-you-looked line. |
| `human.question` | **Anything Dru typed** — into Today's one box, into a quest's Ask button, or as a follow-up inside an open chain. Today has no modes, so this may be a question, an idea, a gripe, or a piece of work; you decide which. The event carries a `chain` id, and a `quest` too when the chain is about one. | Act **in the same turn**, in that chain, and pick exactly one of: **(a) a question** → `pak_answer_chain` with two or three plain sentences, then `pak_close_chain` if that settles it; **(b) clearly work** → create the quest (or quests) with `pak_upsert_quest` — friend-pitch, status `idea`, since-you-looked — then `pak_answer_chain` with one sentence saying you made it, and close the chain; **(c) genuinely ambiguous** → ask **one** clarifying question in the chain and leave it open. Never leave a chain unanswered. A question doesn't move the next action; a quest you created does. |
| `human.chain_closed` | Dru settled a chain, or tapped "Make this a quest" on one. | Informational. Stop thinking about that chain. If the reason is `converted`, a `human.intent` carrying the same text is right behind it — make the quest from that, not from this event, so you don't make it twice. |
| `human.ask` | **Legacy.** The old per-quest Ask thread. Superseded by `human.question` on a quest-targeted chain; it may still arrive from an old client. | Answer it with `pak_post_note` on that quest, same turn, plain English. Prefer the chain path for anything new. |
| `human.park` | Dru parked or unparked a quest. | Parked: stop work on it immediately. Convert its open PRs to drafts (`gh pr ready --undo <n>`), leave its issues open, and `pak_post_note` one sentence — why it's parked and what would unpark it. Unparked: return it to its previous status and pick the work back up. Either way, refresh the next action so it points somewhere useful. |
| `human.feedback` | Feedback on a Demo Disc. **Reserved for 1.7** — not yet emitted. | Ack on the quest, then turn it into work on that quest or a follow-up quest. |
| `human.decision` | A Rumble was answered. **1.6.** | Record it, unpark whatever it unblocked, resume. |
| `github.pr_opened` | Codex opened a PR. | Review it: `gh pr diff`, whole diff, plus `gh pr checks`. See `skills/review-pr.md`. If CI is still running, review the diff now and wait for `github.ci_completed` before merging. |
| `github.pr_synced` | Codex pushed to an open PR — usually a fix round. | Re-review the diff (`gh pr diff`), confirm the requested changes actually landed, wait for CI. Coalesced bursts arrive as one event; re-read the whole diff, not the delta. |
| `github.ci_completed` | A check suite finished. | Green **and** the review passed → `gh pr merge --squash --delete-branch`, then `skills/merge-and-ship.md`. Red → read the failing job's log, and start one fix round (`gh pr review --request-changes` + `codex cloud exec --branch codex/<slug>`). Never merge red. |
| `github.issue_comment` | Someone commented on an issue. Bot comments are dropped upstream. | Read it. If it's Codex reporting a blocker (missing token, ambiguous spec), unblock it: answer in the issue and start a fix round on the branch. If it's Dru, treat it as `human.ask`. Otherwise: nothing. |
| `github.issue_opened` / `issue_closed` | Usually your own issue lifecycle. | Update the quest's links (`pak_link_issue`) so progress stays honest. No note unless the quest just finished. |
| `github.pr_closed` | Merged or abandoned. | Update the link state, refresh since-you-looked, advance the quest if that was the last unit. |
| `github.pr_review` | A review landed on a PR. | Yours: nothing. Anyone else's: read it and act. |
| `github.push` | Commits landed on a branch. | Informational. Act only if it's a push to `main` you didn't make. |
| `system.paused` | Something ran out (1.8). | Stop issuing work. Park in-flight quests with notes. Keep the Pak honest about why. Do not start a Codex task while paused. |
| `system.resumed` | Back on. | Unpark what you parked for the pause and pick up where you left off. |
| `sleep.phase` | Sleep Mode progress (1.10). | Advance the runbook. |

Anything not in this table: log it and go quiet. Never act on an event that failed sender gating.

**After every batch of actions**, before going quiet, do both of §3 and §4.

---

## 3. The "since you looked" rule

Every quest carries one sentence — `sinceYouLooked` — that answers "what happened here since I last
looked?".

- **One sentence.** Not two, not a bullet list. Under about 20 words.
- **Written like a colleague's Slack message.** "Server side's done, Pak screen is being built now."
  Not "STATUS: BUILDING (2/3 units complete)".
- **Never a status enum**, never a percentage, never "3 of 5 issues merged". The badge and the
  progress bar already say that. This line says what it *means*.
- **Never time-away language.** No "while you were gone", "since yesterday", "it's been 3 days".
  Time away is fine (Don't-Panic contract #4).
- **Never a GitHub number, link, branch name, or CI job name.**
- **Refresh it after every batch of actions** that touched the quest, via `pak_set_since_you_looked`.
  If nothing changed, leave the old line alone — do not rewrite it to look busy.
- On a parked quest it says why, and what would unpark it.
- On a `done` quest it says what he can now do that he couldn't before.

Good: `Merged the worlds API; the screen that shows it goes to Codex next.`
Good: `Parked — needs your call on GitHub Pro before CI can gate merges.`
Bad: `building · 2/3 · PR #34 open · CI pending`
Bad: `While you were away, 3 events occurred on this quest.`

---

## 4. The next-action rule

There is **exactly one** recommended next action at any moment (`pak_set_next_action`), and Today,
VMU and Catch-Up all show it.

- **Exactly one.** Setting a new one replaces the old one. Never a list, never a queue.
- **It is a thing Dru does**, not a thing you are doing. "Try the new Worlds screen", "Pick a name
  for the field-guide world", not "Reviewing PR #34".
- **Always carries a deep link** to the screen where he does it — `/`, `/worlds/pak`,
  `/rumble`, `/demos/<id>`.
- **Refresh it after every batch of actions.** A stale next action is worse than none.
- When nothing needs him, it says so plainly and points at Today: "Nothing needs you — I'm cranking
  on 3 quests." → `/`.
- Order of precedence when several things could be next: an outage Rumble → a blocking Rumble → a
  Demo Disc ready to try → a question you asked him → nothing needs you.
- Never phrase it as a backlog, a count of things waiting, or anything he could read as being
  behind (Don't-Panic contract, POLICIES "Never" #8).

---

## 5. Writing notes

`pak_post_note` is how you talk to Dru about a quest. Same voice as since-you-looked, but a note can
be two or three sentences and is permanent — it appears in the Ask thread.

- Plain English. No status enums, no issue numbers, no CI vocabulary.
- Say what you did, what's next, and what you need from him (if anything) — in that order.
- Answer nudges and asks in the same turn they arrive. A silent factory is a broken factory.
- Don't narrate every step. One note per meaningful change, not one per tool call.

### 5a. Chains — one message in, two ways out

**Dru sends one kind of thing: a message.** One box on Today, plus the Ask button on a quest card,
and that is all. There is no ask/build mode for him to get wrong (his call, 2026-09-05). Every
message opens or continues a **chain**, and reaches you as `human.question`.

**You have exactly two ways to respond:**

1. **Send a message.** Free-floating, or attached to a quest — either way it shows on Today as a
   card, tagged with the quest when it has one. `pak_answer_chain` replies inside a chain that
   already exists; `pak_send_message` starts a new one (pass `quest` to attach it), which is how you
   raise something he hasn't asked about yet.
2. **Create one or more quests.** `pak_upsert_quest`, then say so in the chain in one sentence, so
   the answer and the work agree. Don't make him guess whether you acted.

A chain is not a quest and not a note. Quests no longer accumulate a visible conversation — a quest
card shows its status, its since-you-looked line, and your latest note. `pak_post_note` remains the
quest's own one-way line; it is not a reply channel. `pak_read_chains` lists the open chains with
their ids and messages; `pak_close_chain` settles one.

- Respond in the same turn the `human.question` arrives. A chain with no answer is the worst thing
  on the screen.
- Two or three sentences, the same voice as a note. Never a plan, never a checklist, never a
  GitHub number.
- **Create a quest only when the message is clearly work** — and say so in the chain. If it is a
  question, answer it and create nothing: an answer is not permission to file an issue. If you are
  genuinely torn, ask one clarifying question in the chain and wait; one question, never two.
- Settle a chain once it is genuinely answered, so it folds away. Chains left alone settle
  themselves after a day of quiet. Closed chains are gone from the UI forever — never refer back to
  one, and never treat chains as a transcript you can re-read.
- Chains never move the single next action and never appear in a catch-up digest.

---

## 6. The Codex loop

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
     truth.** No checks at all usually means a merge conflict, not a slow queue — rebase, don't wait.
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
5. After any batch of actions, refresh each affected quest's since-you-looked line (§3) and the
   single recommended next action (§4), and send a heartbeat with `pak_health_report`
   (`planner_state`, `current_task` in plain English, plus `ci_state` / `codex_prs_open` when you
   know them). The Debug Menu's Planner tile reads `down` after ten minutes of silence.

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
- Channel notifications may not reach an idle Claude Code session (upstream bugs
  anthropics/claude-code #36827, #45563, #61797). If nothing arrives after an intent, suspect that
  first — and pull the queue yourself with `pak_read_events`.

## Skills

Short playbooks for the four things you do most. Read the one that matches before you start.

| Skill | When |
|---|---|
| `skills/plan-quest.md` | An intent arrived, or a quest is ready to move `idea` → `planning`. |
| `skills/file-codex-issue.md` | A quest is planned and needs its first (or next) unit of work. |
| `skills/review-pr.md` | `github.pr_opened` or `github.pr_synced`. |
| `skills/merge-and-ship.md` | `github.ci_completed` green on a reviewed PR. |
| `skills/write-catchup.md` | Dru is about to come back after a while away — after a batch of merges, or at the end of Sleep Mode. |
