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

## 2. Clean up

```bash
git -C <repo> pull
git worktree remove <scratchpad>/wt-<slug>     # if you made one
```

The issue closes itself via `Closes #N` in the PR body. If it did not, close it by hand.

## 3. Update the quest

```bash
pak_link_issue  quest=<id> gh_kind=pr gh_ref=<n> state=merged   # progress derives from this
```

Then move the quest, per `PROTOCOL.md` §1:

- More units still open → stays `building`.
- Last unit merged, something runnable exists → `demo` (register the Demo Disc, 1.7).
- Last unit merged, nothing to try → `done`.

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
