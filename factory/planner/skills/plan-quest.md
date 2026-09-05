# Skill — plan a quest

Use when a message from Dru turns out to be work, or when a quest is ready to move `idea` →
`planning`. See `PROTOCOL.md` §1 for the lifecycle, §3–§4 for the lines you must refresh afterwards.

## 1. Decide whether it is a quest

Nearly everything Dru sends now arrives as `human.question` on a chain — Today has one box and no
modes, so the message itself does not tell you whether it is a question or a piece of work. You
decide (`PROTOCOL.md` §5a). Read it and pick one:

- **A question** → answer it in the chain and stop. Create nothing.
- **Clearly work** → create the quest (steps 2–4), then reply in the chain with one sentence saying
  you made it, and close the chain. Anything you are ≥ 80% sure about, decide yourself
  (`POLICIES.md`) — don't ask permission to build what he just asked for.
- **Genuinely ambiguous** (two plausible readings that lead to different builds) → ask **one**
  clarifying question in the chain and leave it open. One question, never two.

A quest is something Dru would recognise and could try. If the work is smaller than that, it is a
unit inside an existing quest — say so in the chain, note it on that quest, and skip to step 5.

A `human.intent` means he already tapped "Make this a quest": skip the deciding and go to step 2.

## 2. Pick the World

```bash
pak_read_quests            # what already exists, and in which world
```

Game work → the game world it belongs to. Factory/Pak work → `pak`. If no world fits and Dru asked
for the area, create one; deleting a world is a Rumble, creating one is not.

## 3. Write the pitch

One line you would say to a friend, present tense, about what he can do afterwards.

- Good: `Walk away, come back, be caught up in a minute.`
- Good: `Make founder decisions from the phone instead of a terminal.`
- Bad: `Implement presence tracking and catch-up digest generation.`

Title is 2–5 words, no ticket voice.

## 4. Create it

```bash
pak_upsert_quest    id=<kebab-slug> world=<worldId> title="…" pitch="…" status=idea
pak_set_since_you_looked  quest=<id> text="…"     # PROTOCOL §3
```

The id is a stable kebab-case slug (`catch-up`, `demo-discs`). It goes in every issue body as
`<!-- quest:<id> -->` and is how Wake routes GitHub events back to the quest.

## 5. Split it, when you pick it up

Move to `planning` (`pak_set_quest_status`), then split into units Codex can finish in about an
hour each. Sequence anything that shares a package — Codex works off `main`, so a dependent unit
cannot start until the one before it merges. Independent units may run in parallel.

Write the sequence down in a note on the quest, in plain English, so the Ask thread explains itself.

## 6. Close the loop

```bash
pak_set_since_you_looked  quest=<id> text="…"
pak_set_next_action       text="…" deep_link=/worlds/<worldId>
```

Then file the first issue → `file-codex-issue.md`.
