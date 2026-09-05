# Skill — write the Catch-Up

Use when Dru is likely to come back to a Pak he has not looked at in a while: after a batch of
merges, at the end of a work block, and always as the last phase of Sleep Mode (`sleep-mode`, 1.10).
Also use it right after any `human.seen` event that followed a long gap — that is him arriving, and
the briefing he reads next should be yours, not the mechanical one.

The Catch-Up screen appears on return after more than **2 hours away** or more than **20 unseen
events**. Otherwise it is skipped and he lands on Today. You do not control that gate; the server
does. You control what the card says.

## 1. Look before you write

```
pak_read_catchup        # what the Pak would show right now: show?, awaySeconds, unseenCount, digest
pak_read_quests         # current status of everything
pak_read_events since=<the digest's fromEventId>
```

The mechanical digest is the floor, not a draft to polish. It lists quest titles under headings. You
are writing the two sentences a colleague would actually say.

## 2. Write it

```
pak_write_catchup
  rumbles: [{ text: "…", deep_link: "/rumble" }]
  demos:   [{ text: "…", deep_link: "/demos" }]
  shipped: [{ text: "…", deep_link: "/worlds/pak" }]
  fyi:     ["…"]
```

Four sections, and the card renders them in that order: **what needs him → what he can try → what
landed → what he might want to know**. Leave a section empty rather than padding it.

Rules for the lines:

- **One sentence each, under about 15 words.** The card is read standing up, in under a minute.
- **Say what it means, not what happened.** `You can mark a quest done yourself now.` Not
  `Merged pak-polish: mark-done control`.
- **Every line gets a deep link** to the screen where it pays off — `/rumble`, `/demos`,
  `/worlds/<worldId>`, `/`.
- **Never a GitHub number, link, branch, CI job, or issue count.** Same rule as notes
  (`PROTOCOL.md` §5).
- **Never time-away language.** No "while you were gone", no "it's been 3 days", no counts of things
  waiting (Don't-Panic contract #1 and #4).
- **Shipped means shipped** — merged and real. A quest he marked done himself belongs here too.
- **`fyi` is for things with no action**: Sleep Mode ran clean, the factory paused and resumed, a
  quest is parked and why. Three at most.
- If genuinely nothing happened, write one `fyi` line saying so plainly and stop. An honest quiet
  card beats an invented one.

## 3. Then set the next action

The Catch-Up card ends with the one recommended next action, so refresh it in the same turn
(`PROTOCOL.md` §4):

```
pak_set_next_action text="…" deep_link="/…"
```

Precedence: outage Rumble → blocking Rumble → Demo Disc ready to try → a question you asked him →
nothing needs you.

## 4. Keep it fresh

A digest is cached against the range of events it covers, so a new event automatically invalidates
it and the mechanical fallback takes over until you write again. That is the safety net for a
Planner that is down or Paused — it is not a reason to write once and forget. Rewrite whenever the
answer to "what would he want to know if he walked in right now?" has changed.
