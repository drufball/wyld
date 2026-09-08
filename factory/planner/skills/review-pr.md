# Skill — review a PR

Use on `github.pr_opened` and `github.pr_synced`. You review every PR; Dru never does.

## 1. Read the whole diff

```bash
gh pr view <n> --json title,body,headRefName
gh pr diff <n>
```

The whole diff, not Codex's summary — including on a `pr_synced` fix round, since bursts are
coalesced into one event.

## 2. Check CI — it is the truth

```bash
gh pr checks <n>
```

**Codex's self-reported checks have been wrong repeatedly**: missing tests, shell bugs, UI that
overflows a phone, SSE that opened hundreds of connections. Believe `gh pr checks` and what you ran
yourself. *No checks at all* means a merge conflict, not a slow queue — rebase, don't wait.

## 3. Run what it ships

A diff cannot show behaviour. Pull the branch into a worktree under the scratchpad dir and run it —
`git worktree add <scratchpad>/wt-<slug> codex/<slug>`. Services: start it and curl the new routes,
checking shapes and status codes. UI: build it and open it at 375×812 **and** 1280×900. Remove the
worktree once the PR merges (`git worktree remove`).

## 4. Judge it

- Every acceptance criterion from the issue is actually met — check them one by one.
- No new globals. No secrets. Nothing under `.factory/`.
- No issue/PR numbers or GitHub links leaking into anything the Pak renders.
- Idiomatic for this codebase; reuses what exists instead of reinventing it.
- Not over-engineered for what the issue asked. No speculative abstraction layers.
- Do not nitpick what the linter and formatter already enforce.

## 5. Request changes, or merge

```bash
gh pr comment <n> --body-file <the review, specific and ordered>
npx -y @openai/codex@latest cloud exec \
  --env 6a9be268ad288191b44bbdefcbe977ee --branch codex/<slug> \
  "Address the review on PR #<n> of drufball/wyld: <feedback verbatim>. Commit and push to the same \
branch; do not open a new PR."
```

`--branch` reads the branch as it exists on GitHub **now** — push anything you applied locally
first, or Codex works from a stale branch.

Green and correct → `merge-and-ship.md`.

## 6. Keep the Pak honest

Post a note only when the state actually changed in a way Dru would care about. Refresh the quest's
since-you-looked line (`PROTOCOL.md` §3) — in plain English, with no PR number in it.

## Workshop PRs (from 2026-09-08)

The Species workshop's **Ship** button opens PRs titled `Workshop: <n> species changed` on branches `workshop/<timestamp>`. They are data-only (`game/src/data/species.json`), authored by Dru through the Pak, and arrive as `github.pr_opened` like any other. Review them as a senior engineer in one pass: the diff is species data — check it against the same rules the workshop enforces (tier bands, body plan → deliveries, hide table, hints naming no region/phase/species), confirm CI is green (the game's tests run on it), squash-merge, then re-register every disc whose scenario shows the changed species so the next build carries it, and tell Dru on the quest card in one line ("Your Loamox is in the game — the next disc has it"). Never treat a Workshop PR as a Codex task; there is no fix round — a bad one is closed with a one-line reason and the draft stays in the Pak for him to correct.
