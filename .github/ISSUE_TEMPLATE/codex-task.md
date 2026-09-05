---
name: Codex task
about: A single unit of implementation work for the Codex GitHub app
title: ""
labels: []
assignees: []
---

<!-- quest: -->

@codex please implement this.

## Context

Why this exists and what already landed that it builds on. Link prior PRs if relevant.
Read `AGENTS.md` at the repo root before starting.

## Task

What to build, concretely. File paths, package names, endpoint shapes, and any design decisions
already made. State design choices explicitly rather than leaving them open.

## Acceptance criteria

- [ ] ...
- [ ] ...
- [ ] `AGENTS.md` conventions followed (ESM, no default exports, tests alongside code)
- [ ] No new dependencies beyond those named above, or the PR states why

## Verify

Run these and paste the results into the PR description:

```bash
./scripts/bootstrap.sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Out of scope

- `factory/planner/` — never edit it
- Anything not listed under Task; open a follow-up instead of expanding this PR
