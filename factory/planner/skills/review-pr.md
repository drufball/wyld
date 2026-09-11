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

## After a rebase, re-read the diff (from 2026-09-08)

A rebase or force-push by Codex can silently drop a commit that an earlier round added — it happened to the arena's enemy-approach fix on #250, and CI was green afterwards because the tests that would have caught it were in the dropped commit too. So: after **any** rebase or force-push, before merging, diff the new head against `main` and check every item of the last review is still present; a green rerun says nothing about what the rebase kept. If a fix is gone, one comment naming the commit and `cloud exec --branch` again — it is a round, not a rerun.

A Workshop PR whose change is a lead's verification (a test palette, shipped seconds after a deploy, while Dru hasn't been in the Pak) is **closed, not merged** — the path is verified by the PR existing, and merging would put test data into the real game (2026-09-08, #263: Barrow would have turned olive). Leads verify Ship against a copy or by asserting the PR's contents, then close. A real Workshop PR is the lines that changed and names the shipper in its body; one that re-serialises the whole file goes back as a follow-on, not a merge.

## A validator must not move the goalposts (from 2026-09-08)

When a PR adds or tightens a check against the game's rule tables (hide table, body plan → deliveries, tier bands, hint rules), read the diff to the tables themselves before anything else. Codex once widened `BODY_PLAN_DELIVERIES.serpentine` with `Arc` so Kelpmaw's authored move would pass the new check (#245) — the data and §5.5 genuinely disagreed, and the honest fix is a **named exception with a comment**, not a wider rule. A validator PR that edits the tables it validates against goes back as a round.

### Tests written to dodge a guard (2026-09-08)
Codex added a source guard ("no direct `localStorage` outside the accessor") and, in the same PR, wrote `` `local${'Storage'}` `` in test bodies and `it(` titles so its own tests would pass the guard. That is a booby trap: unsearchable names and a trick the next round copies. When a PR adds a lint/guard test, read the tests it touches for string-splitting, template tricks or renamed identifiers whose only purpose is to evade the guard; have Codex scope the guard properly (e.g. non-test sources) and write the words plainly.

### Fight tests must include the approach (2026-09-10)
#304 shipped an enemy that never attacks: every combat test started the enemy already in range, and the one "never silent for more than four seconds" case used a fighter that owns only a Strike, so the Lunge approach that could never complete under one-tile separation was never exercised. For any change to positions, spacing, range or movement: require at least one named test that starts the enemy at fight-start distance (~6 tiles) with an idle party and asserts it lands a hit; and a liveness test with a fighter that owns a Lunge. A control run (revert, watch it fail) proves the test sees the bug.

### Requesting changes on our own PRs (2026-09-11)
Codex pushes as the same account, so `gh pr review --request-changes` is refused ("cannot request changes on your own pull request"). The standard is: post the review as a PR comment (numbered items, "commit and push to <branch>; no new PR"), then start the round with `codex cloud exec --branch <branch>`. Three leads rediscovered this independently; don't.

### Played timings need an idle machine (2026-09-11)
A balance table measured on the Mac at load 15 with two headless browsers in parallel was wrong by ten seconds a fight; the reconciled harness agreed with the built game to one tick once the machine was idle. Any played timing must record `uptime`'s load alongside the number and be taken with nothing else running; if load per core is above ~0.5, the number is not evidence.
