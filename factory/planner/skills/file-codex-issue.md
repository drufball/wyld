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
- **Verify** — `./scripts/bootstrap.sh`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
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
