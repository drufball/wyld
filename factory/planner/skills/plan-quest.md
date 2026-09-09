# Skill — plan a quest

Use when a message from Dru turns out to be work, or when a quest is ready to move `idea` →
`planning`. See `PROTOCOL.md` §1 for the lifecycle, §3–§4 for the lines you must refresh afterwards.

## 1. Decide whether it is a quest

Nearly everything Dru sends now arrives as `human.question` on a chain — Today has one box and no
modes, so the message itself does not tell you whether it is a question or a piece of work. You
decide (`PROTOCOL.md` §5a). Read it and pick one:

- **A question** → answer it in the chain and stop. Create nothing. Do not settle the chain — Dru does.
- **Clearly work** → create the quest (steps 2–4), then reply in the chain with one sentence saying
  you made it, and leave the chain open for him to settle. Anything you are ≥ 80% sure about, decide yourself
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

## The explainer comes first (Dru's rule, 2026-09-08)

Every quest gets its explainer **at planning**, before the first issue is filed: the pitch in one screen, and a **mockup or clickable prototype** of the thing (HTML, inline only — the same constraints as every artifact). Dru pins on it; the pins shape the brief. When the quest reaches `demo`, the same explainer gets the live demo embedded (see merge-and-ship §3) — the mockup stays above it so the before and after sit together. A quest with no explainer is not planned.

### A mockup must be live the moment it scrolls into view (Dru, 2026-09-09)
Dru opened the arena explainer straight to "The fight" and found no Swap button and nothing tappable — the card only came alive after picking an enemy and three creatures in sections above it. Every mockup section starts in a ready state (a sensible default already chosen) and every drawn thing that looks tappable is tappable; a section may never depend on taps made in another section. Check it on a 375-wide viewport by scrolling to the section cold and tapping.

### Quests are contained and closable; missions live on the roadmap (Dru, 2026-09-09)
Dru: "a fight you can learn from is the roadmap / top level mission now, and it should have many quests that we make progress through. Right now it feels like it's just one mega quest I keep commenting on and never closing out bits."
- A **quest** is one outcome Dru can mark done within days, with a one-line "done when…" in its pitch. If a quest keeps receiving new units after it reached `demo`, it has become a mission: leave it as shipped and split the new work into new quests.
- A **mission** is a block on the roadmap, not a quest: what will be true, the quests under it (with their state), the live playthrough embedded (`data-wyld-demo` iframe), and the mockups for what's next. Dru's feedback on a mission lands on the roadmap or on a quest's explainer, never on a bucket quest.
- Each new quest still gets its own explainer (mockup first), but it may be short and may embed the same disc with a different scenario/section.
