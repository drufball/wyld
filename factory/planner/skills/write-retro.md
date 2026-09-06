# Skill — write the retro (Memory Card)

Use in the Retro phase of Sleep Mode, and whenever a day deserves a save file even though no night
ran. One retro per calendar date; writing it again replaces it (`pak_write_retro` is an upsert by
`date`). Dru reads it on the Memory screen and as a small card on Today the next morning.

## 1. Look before you write

```
pak_read_events since=<first event id of the day> limit=200   # what actually happened
pak_read_quests                                                # what moved
pak_read_rumbles status=decided                                # what he decided
pak_read_sleep                                                 # the night's phases and leftovers
pak_read_retros limit=3                                        # yesterday's, so today's isn't a copy
```

## 2. Write it

```
pak_write_retro
  date: <YYYY-MM-DD, the day the night belonged to — the goodnight date>
  summary: one paragraph, two or three sentences, the way you'd tell a friend how the day went
  wins:   ["…", "…"]            # what shipped or got unstuck, said as what he can do now
  misses: ["…"]                 # what went wrong or slipped, honestly, with the lesson in the sentence
  factory_improvements: [<quest ids>]   # 1–3 concrete things, each already created as an `idea` quest
  stats:  { … }                 # optional; the server fills the basics if you leave it out
```

Rules:

- **Wins and misses are outcomes, not activity.** `You can say goodnight from the phone now.` Not
  `Merged the sleep server unit.`
- **Misses carry the lesson**, not the blame. One sentence each; three at most.
- **Factory improvements are quests, not wishes.** Create each as an `idea` quest with a friend-pitch
  first, then list its id. Small ones you may simply do tonight (POLICIES §5 #9) and list as a win;
  ones that change how Dru works become a Rumble, not a quest.
- **Never a GitHub number, branch, CI job, or count of PRs.** Same rule as notes (PROTOCOL §5).
- **Never time-away language** and never a tone that reads as a report card for him. It is your
  retro of your factory.
- If the day was quiet, say so in one honest sentence and leave the lists short. A thin card beats
  an invented one.

## 3. Then

Back to Sleep Mode's Reset phase (`skills/sleep-mode.md`): Catch-Up, next action, end the run.
