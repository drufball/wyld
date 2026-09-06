# Skill — merge and ship

Use on `github.ci_completed` when the check suite is green and the review has passed.

## 1. Confirm, then merge

```bash
gh pr checks <n>          # must show: ci  pass
gh pr merge <n> --squash --delete-branch
```

Never merge red. Never merge a diff you have not read. Never force-push `main`.
There is no branch protection on this repo — nothing server-side will stop you (`PROTOCOL.md` §6).

If CI is red instead: read the failing job's log, then run **one** fix round on the branch
(`review-pr.md` step 5). Do not start a second Codex task for the issue.

## 2. Deploy to the live factory

Merging is not shipping — Dru sees the *built* Pak, not `main`. In the live checkout
(`/Users/crawnk/wyld`), after every merge:

```bash
git -C /Users/crawnk/wyld pull
# touched @wyld/shared?  → rebuild it or the live server crashes on its watcher restart:
pnpm --filter @wyld/shared build
# touched factory/pak?   → rebuild the served bundle or Dru keeps seeing the old UI:
pnpm --filter @wyld/pak build
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8787/api/events?limit=1"   # expect 200
```

Skipping the Pak rebuild is how "the flatten merged but Dru still saw the Worlds tab" happened
(2026-09-05). Then clean up: `git worktree remove <scratchpad>/wt-<slug>` if you made one. The
issue closes itself via `Closes #N` in the PR body; if it did not, close it by hand.

## 3. Update the quest

```bash
pak_link_issue  quest=<id> gh_kind=pr    gh_ref=<n> state=merged   # progress derives from this
pak_link_issue  quest=<id> gh_kind=issue gh_ref=<N> state=closed   # the issue `Closes #N` shut — record that too,
                                                                   # or the quest sits at 0.8 forever (seen twice, 2026-09-06)
```

Then move the quest, per `PROTOCOL.md` §1:

- More units still open → stays `building`.
- Last unit merged, something runnable exists → `demo`, **and register its try-it card** (below).
- Last unit merged, nothing to try → `done`.

### Every quest reaching `demo` gets a try-it card (Dru's rule, 2026-09-06)

A card is what Dru sees on the Demos screen and behind the quest card's Try it button: what changed at a
glance, numbered steps to try it, and the test data you put in place. Register it with the same
tool that registers a game disc:

```bash
# factory / Pak change — tried against the live Pak (the default):
pak_register_demo  slug=<questId> kind=live ref=<merge sha> quest=<questId> \
                   summary="<1–2 sentences: what changed, in his words>" \
                   steps='["Open …", "Tap …", "You should see …"]' \
                   seeded='["<what you put there for him to find>"]' \
                   deep_link=/<screen where step 1 starts>
# game change — a Demo Disc, as before:
pak_register_demo  slug=<questId> ref=<branch or sha> quest=<questId>
```

- **Seed first, then register.** Put the sample data in through the live API (`localhost:8787/api/...`)
  before the card exists, so step 1 works the moment he taps. Never seed anything destructive, and
  never through a scratch server — the card points at the live Pak.
- Steps are things *he* does, one action each, in order, ending with what he should see. No
  GitHub numbers, branches or CI words anywhere on the card.
- Re-registering the same slug updates the card in place — do that when a follow-up round changes
  what he'd see.
- **Branch build first** (kind `pak`, once unit 4 of `try-it-cards` ships) for big or risky factory
  changes, or anything that alters how Dru works: register the branch build before merging, let him
  try it, then land it and re-register as `live`. The Planner picks per quest.

```bash
pak_set_quest_status      quest=<id> status=<next>
pak_post_note             quest=<id> text="<what he can now do that he couldn't before>"
pak_set_since_you_looked  quest=<id> text="…"
```

## 4. Set the one next action

```bash
pak_set_next_action text="…" deep_link=/worlds/<worldId>
```

Exactly one, always a thing **he** does, always with a deep link (`PROTOCOL.md` §4). If nothing
needs him, say so plainly and point at `/`.

## 5. Then keep going

Pick up the next unit of work without being asked (`POLICIES.md`: file issues, merge green PRs,
spend at any hour). Going quiet is for when there is nothing to do, not for when a PR just merged.
