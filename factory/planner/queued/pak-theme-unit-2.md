<!-- quest:pak-theme -->

## Context

Unit 1 of the Pak restyle (#89) landed the design system: Tailwind CSS v4 via `@tailwindcss/vite`,
the Dracula token set in `factory/pak/src/theme.css`, the shadcn primitives in
`factory/pak/src/components/ui/` (`button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`,
`textarea.tsx`) plus `src/lib/utils.ts`'s `cn()`, and the migrated app shell, `Nav`, `Today`,
`ChainList` and `InFlight`.

This is unit 2 of 3: migrate **Quests**, **Rumble** and **Catch-Up** onto those same primitives and
delete their CSS from `theme.css`. Unit 3 then does VMU, Debug, Demo Discs and the leftovers.

Read `AGENTS.md` at the repo root, and read `factory/pak/src/components/ui/*.tsx`,
`src/screens/Today.tsx`, `src/components/ChainList.tsx` and `src/components/InFlight.tsx` first —
those are the reference for how a migrated screen looks in this codebase. Reuse the primitives; do
not invent a parallel set.

Files this unit owns:

- `factory/pak/src/screens/Quests.tsx` (+ `Quests.test.tsx`)
- `factory/pak/src/screens/Rumble.tsx` (+ `Rumble.test.tsx`)
- `factory/pak/src/screens/CatchUp.tsx` (+ `CatchUp.test.tsx`), and `src/CatchUpGate.tsx` if its
  wrapper needs a class change
- the corresponding rule blocks in `factory/pak/src/theme.css`

## Task

### The design, already decided — do not re-open any of it

- **Palette / tokens:** everything comes from the tokens unit 1 defined. No new colour values, no
  hard-coded hex in a component. Dracula comment `#6272a4` is borders and rules only, never text —
  dim text is `--color-muted-foreground`.
- **Fonts:** the pixel font (`font-display`) on **headings, badges, card labels and short accents
  only**. Every sentence, paragraph, quest pitch, since-you-looked line, rumble context and
  catch-up line is body text in `font-mono`. A full-sentence heading is not an accent — if a title
  is long enough to wrap on a 375px phone, it belongs in the body face. The base layer applies the
  pixel font to `h1` only; everything else opts in with `font-display`.
- **Cards:** `Card variant="bevel"` is the retro Debug-menu tile treatment and is the default for a
  card that is a *thing* (a quest, a rumble, the catch-up card). `variant="flat"` is for quieter
  surfaces. `data-tone` (`ok` / `warn` / `bad` / `accent`) colours the top edge.
- **Controls:** `Button` for every button (`retro` for the console-style actions, `default` for a
  primary submit, `ghost` for an inline retry), `Badge` for chips and tags, `Textarea` for every
  multi-line field. **Every interactive control is at least 44×44px** — that explicitly includes the
  Quests world/status filter chips, which are 34px today and are the last leftover from the
  `pak-polish` quest.
- **Spacing:** Tailwind's scale or the `--pak-space-*` tokens. No raw `rem` in new CSS or inline
  styles. The `.quest-filter` / `.world-tag` rules in `theme.css` currently use raw `rem` and go
  away with this unit.
- Dark only. No light theme, no theme toggle. Functional motion only (the progress fill and the
  existing `.today-ack` acknowledgement fade); honour `prefers-reduced-motion`.

### Class names are a test contract

The Playwright specs select on class names, and unit 1 lost half a day to this. These must stay on
the migrated elements, alongside their Tailwind classes:

- `quest-card` — the quest `<article>` (`chains.spec.ts`, `today.spec.ts`)
- `rumble-card` — a rumble card (`rumble.spec.ts`)
- `chain-card` — already handled in `ChainList.tsx`; do not remove it
- `today-ack` — the "Nudged. Fable's on it." paragraph keeps its animation class

Before you push, grep `factory/pak/e2e/*.spec.ts` for `locator('.` and confirm every class it names
still exists in the DOM. **Do not edit any spec file.** And grep `src/**/*.tsx` for class names whose
rule you deleted from `theme.css` — a live `className` with no rule is silent, and neither the
linter nor the tests catch it.

### Quests (`src/screens/Quests.tsx`)

- `QuestCard`: `Card variant="bevel"`, `data-tone` from status (`demo` → `ok`, `building` →
  `accent`, `parked` → `warn`, otherwise none). Title in the body face at a readable size (it is a
  sentence, not an accent); world tag and status chip as `Badge`; the `since you looked` / last-note
  block as quiet body text on a muted surface, the way `ChainCard` renders its messages.
- The progress bar keeps its `role="progressbar"` and all four aria attributes exactly as they are,
  and keeps its fill animation. Rebuild it with Tailwind rather than the `.quest-progress` rules;
  fill colour is `--color-dracula-green`, track is `--color-muted`.
- The action row (Nudge / Park / Unpark / Done / Ask, and the disabled Demo button with its "not
  yet") becomes `Button variant="retro"` at ≥44px, wrapping cleanly at 375px. Same labels, same
  `aria-expanded` on Ask, same disabled state on Demo.
- `AskComposer` uses the shared `Textarea` + `Button`, keeping the auto-grow `useLayoutEffect`, the
  Enter-to-submit handler and the `Ask about this quest` label association exactly as they are.
- The filter rows: `WORLD` and `STATUS` labels in the pixel font as small caps; each chip a
  `Button` (`retro` when `aria-pressed`, `outline` otherwise) at **≥44px tall**, keeping
  `aria-pressed` and the exact labels. Rounded-full is fine for the chips; everything else stays
  square.
- Keep the `Done (n)` collapsed section, its `aria-expanded`, "Show all quests", and the
  "No quests match these filters." empty state (which currently uses the `.pak-dim` class — replace
  it with `text-muted-foreground`).

### Rumble (`src/screens/Rumble.tsx`)

- Each rumble is a `Card variant="bevel"` with `class="rumble-card"`, `data-tone="bad"` for an
  outage kind and `accent` otherwise. The kind chip (`ACCOUNT`, `MONEY`, …) is a `Badge`.
- Card title in the body face — these are sentences and they wrap badly in the pixel font on a
  phone. Context text is body-face `text-muted-foreground`.
- Option buttons are `Button variant="retro"`, full width on a phone, ≥44px, keeping the disabled
  state while deciding and the retry path.
- "Ask for more" and its `ChainCard` keep working unchanged.
- The `Already decided (n)` `<details>` keeps its disclosure behaviour; style the `summary` as a
  ≥44px pixel-font row.

### Catch-Up (`src/screens/CatchUp.tsx`)

- The card becomes a `Card variant="bevel"`; drop the `Panel` wrapper here and use `Card` directly.
- `Catch-Up` stays an `h1` in the pixel font. The section headings (`Needs you`, `Ready to try`,
  `Shipped`, `Worth knowing`) are short accents — pixel font, small, accent-coloured, fine as they
  are today.
- The lines are body text; each link is a **≥44px tall tappable row**, not a run of inline text
  (they measure 18px today). Give them a hover/focus treatment and a `--color-ring` focus ring.
- The next action renders through the `.today-action` rule today. Replace it with the same
  treatment `Today` uses: a bevel card with a small pixel-font `NEXT` label and the sentence in the
  body face, the whole thing a link with the same accessible name. Then delete `.today-action`.
- `Got it` becomes `Button variant="retro"` (or `default`) at ≥44px, with the accessible name
  unchanged — `catchup.spec.ts` clicks it by name.

### theme.css

Delete every rule these three screens no longer use: `.catch-up*`, `.today-action`, `.worlds`,
`.world-quests`, `.world-grid`, `.world-door*`, `.quest-list`, `.done-quests*`, `.quest-card*`,
`.quest-status*`, `.quest-progress`, `.quest-context`, `.quest-actions`, `.quest-demo`,
`.ask-composer*`, `.quest-retry`, `.quest-filters`, `.quest-filter`, `.world-tag`, `.rumble-*`
(except anything VMU still needs — `.vmu-rumbles` stays until unit 3). Keep `.pak-dim` only if
something outside these three screens still uses it. Leave the VMU, Debug and Demo Disc blocks
alone; unit 3 owns them.

## Acceptance criteria

- [ ] Quests, Rumble and Catch-Up render entirely through the `src/components/ui/` primitives and
      Tailwind utilities; no screen-specific CSS class remains for them in `theme.css` except the
      test-contract hooks listed above.
- [ ] Every interactive control on all three screens measures at least 44×44px in the browser at
      375px wide — including the world and status filter chips, and the Catch-Up digest links.
- [ ] The pixel font appears only on `h1`, section headings, badges, card labels and short accents.
      No sentence-length text is in the pixel font on any of the three screens.
- [ ] No horizontal scrolling at 375px on any of the three screens; long unbroken quest titles and
      chain text wrap (`wrap-anywhere`, not the non-existent `overflow-anywhere`).
- [ ] All text clears 4.5:1 contrast; `#6272a4` is not used for text.
- [ ] No route, accessible name, `aria-*` attribute, visible string or API call changed. The whole
      Playwright suite passes **unchanged** — no spec file edited.
- [ ] Every class name still referenced from `src/**/*.tsx` has a rule, or has been replaced by
      Tailwind utilities.
- [ ] Screens not migrated in this unit (VMU, Debug, Demo Discs, the Demo player) are still
      visually intact at both widths.
- [ ] `AGENTS.md` conventions followed (ESM, named exports only, tests alongside code).
- [ ] No new dependencies.

## Verify

Run all of these and paste the results into the PR description:

```bash
./scripts/bootstrap.sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build          # must run before smoke — smoke runs the BUILT server and Pak
pnpm smoke
```

Then look at it in a browser at **375×812** and **1280×900** and attach a screenshot of `/quests`,
`/rumble`, `/catch-up`, `/` and `/debug` at both widths **to the PR description**. Do not commit
screenshots into the repo.

To run it locally, build first, then start the server against a **scratch** factory on a port you
picked programmatically (never 8787, 8788 or 8799):

```bash
pnpm build
FACTORY_DIR=$(mktemp -d) REPO_DIR=$(mktemp -d) PAK_PORT=<free port> \
  PAK_DIST="$PWD/factory/pak/dist" WAKE_URL= WAKE_SECRET= node factory/server/dist/main.js
```

Seed two worlds, several quests across every status, an open rumble, a decided rumble and a chain
through the API so none of the screens are empty.

## Out of scope

- `factory/planner/` — never edit it.
- `factory/wake`, `factory/shared`, `factory/server`, `game/` — another agent is working in
  `factory/wake` and `factory/shared`. Touch nothing outside `factory/pak`.
- VMU, the Debug Menu, Demo Discs and the Demo player — unit 3.
- Any behaviour, copy, route or API change. Any new dependency. Any light theme. Any decorative
  animation. Committing screenshots to the repo.
