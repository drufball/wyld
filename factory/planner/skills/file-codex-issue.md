# Skill — file a Codex issue

Use when a quest in `planning` (or `building`) needs its next unit of work.
Full loop and its sharp edges: `PROTOCOL.md` §6.

## 1. Scope it to about one hour

One issue = one coherent unit. If you cannot write testable acceptance criteria for it in a dozen
bullets, it is two issues. Keep its footprint to the packages it actually needs.

## 2. Write the body

Use `.github/ISSUE_TEMPLATE/codex-task.md`. Five sections, always:

- **Context** — why this exists, what already landed that it builds on, which existing helpers to
  reuse rather than rewrite. Name the files.
- **Task** — concrete. File paths, package names, endpoint shapes, table columns, event kinds.
  **State every design decision explicitly**; an open question in the body comes back as an
  invented answer in the diff.
- **Acceptance criteria** — testable checkboxes, plus the `AGENTS.md` conventions and
  no-new-dependencies lines.
- **Verify** — `./scripts/bootstrap.sh`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`,
  plus `pnpm smoke` when the issue touches `factory/pak` (that is the Playwright suite's name; it
  is isolated from the live factory since #45, so it is safe to run while the factory is up).
  For a service, add the exact `curl` commands and ask for the responses in the PR description.
- **Out of scope** — `factory/planner/` always, plus every package this issue must not touch.

Last line of the body: `<!-- quest:<questId> -->`. Codex copies it into the PR, and Wake reads it to
route `github.*` events back to the quest.

Never write `@codex` anywhere: a mention-triggered task has no environment, no `GH_TOKEN`, and
cannot push.

## 3. File and start exactly one task

```bash
gh issue create --repo drufball/wyld --title "…" --body-file <path>

BODY=$(cat <path>)
npx -y @openai/codex@latest cloud exec \
  --env 6a9be268ad288191b44bbdefcbe977ee --branch main \
  "Implement GitHub issue #N of drufball/wyld. $BODY. Follow AGENTS.md including 'Publishing your \
work': push branch codex/<slug> and open a PR whose body contains 'Closes #N'."
```

`--env` takes the environment **ID**; the label `drufball/wyld` resolves to a different, token-less
environment and silently produces a task that cannot push. One task per issue, ever — a wrong or
stuck task is fixed with a review round on the branch it opened, never a second task.

## 4. Update the Pak, then wait

```bash
pak_link_issue          quest=<id> gh_kind=issue gh_ref=<N> state=open   # private
pak_set_quest_status    quest=<id> status=building
pak_set_since_you_looked quest=<id> text="…"                            # no issue number
pak_set_next_action     text="…" deep_link=/worlds/<worldId>
```

Then poll in one loop capped at 30 minutes — 4–8 minutes is typical:

```bash
until gh pr list --json number,headRefName | grep -q '"codex/'; do sleep 60; done
```

When the PR appears → `review-pr.md`.

## Migrations when leads run in parallel (from 2026-09-08)

Five leads in one evening produced two migration-number collisions (`0019` landed mid-review; the other PR went CONFLICTING and had to renumber to `0020`). When an issue adds a database migration, the issue body says: **read `factory/server/src/migrations/_journal.json` immediately before pushing and take the next number then — not the number you saw when the issue was written**; if a rebase is needed, renumber and confirm the snapshot's `prevId` chains off the newest. The lead verifies the migration against a copy of the live database before merging.
