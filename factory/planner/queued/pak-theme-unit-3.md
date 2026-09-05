<!-- quest:pak-theme -->

## Context

Unit 1 of the Pak restyle (#89 / PR #91) landed the design system: Tailwind CSS v4 via
`@tailwindcss/vite`, the Dracula token set in `factory/pak/src/theme.css`, the shadcn primitives in
`factory/pak/src/components/ui/` (`button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`,
`textarea.tsx`) plus `src/lib/utils.ts`'s `cn()`, and the migrated app shell, `Nav`, `Today`,
`ChainList` and `InFlight`. Unit 2 migrated Quests, Rumble and Catch-Up.

This is unit 3, the last one: **VMU**, the **Debug Menu**, the **Demo Discs grid and player
chrome**, plus the final clean-up. When it merges, every screen in the Pak runs on one design
system and `theme.css` is tokens and base styles only.

Read `AGENTS.md` at the repo root, and read `factory/pak/src/components/ui/*.tsx`,
`src/screens/Today.tsx` and `src/screens/Quests.tsx` first — those are the reference for how a
migrated screen looks here. Reuse the primitives; do not invent a parallel set.

Files this unit owns:

- `factory/pak/src/screens/Vmu.tsx` (+ `Vmu.test.tsx`)
- `factory/pak/src/screens/Debug.tsx` (+ `Debug.test.tsx`)
- `factory/pak/src/screens/Demos.tsx` (+ `Demos.test.tsx`)
- `factory/pak/src/components/Panel.tsx`, `NotYet.tsx`, `src/screens/Memory.tsx`
- `factory/pak/src/theme.css` — everything that is left
- optionally `factory/pak/src/live/LiveEvents.tsx` (see the last task)

## Task

### The design, already decided — do not re-open any of it

Same rules as units 1 and 2. Everything comes from the tokens; no hard-coded hex in a component.
Dracula comment `#6272a4` is borders and rules only, never text. The pixel font (`font-display`)
goes on headings, badges, card labels and short accents only — never on a sentence. Cards are
`Card variant="bevel"` (the retro tile) or `flat`; `data-tone` colours the top edge. Every
interactive control is at least 44×44px. Spacing from Tailwind's scale or the `--pak-space-*`
tokens, never a raw `rem`. Dark only. Functional motion only, and honour `prefers-reduced-motion`.

### Class names are a test contract

The Playwright specs select on class names. `demo-card` must stay on a demo card
(`demos.spec.ts`). Before pushing, grep `factory/pak/e2e/*.spec.ts` for `locator('.` and confirm
every class it names still exists in the DOM. **Do not edit any spec file.** Also grep
`src/**/*.tsx` for any class whose rule you deleted from `theme.css` — a live `className` with no
rule is silent, and neither the linter nor the tests catch it.

### Debug Menu (`src/screens/Debug.tsx`) — keep the look, move it onto the primitives

This screen is the design reference and it already looks right. **Do not restyle it.** The job is
purely to take it off the last of the bespoke CSS:

- `Tile` renders through `Card variant="bevel"` with `data-tone` (it already does, via `Panel`).
  Replace the `.debug-tile*` rules with Tailwind utilities on the same elements so the result is
  pixel-identical: dim body-face label (13px, `--color-muted-foreground`, **not** the pixel font),
  the value in the pixel font at 18px with `wrap-anywhere`, small print at 14px underneath, and the
  tone-coloured top border (no tone → `--color-muted-foreground`, ok → green, warn → yellow, bad →
  red).
- Keep `.debug-grid`'s behaviour: `repeat(auto-fit, minmax(160px, 1fr))`, single column under
  480px.
- The paused banner and the "Can't reach the factory right now" error keep their treatment.
- Screenshot the before and after side by side and confirm they match.

### VMU (`src/screens/Vmu.tsx`)

The phone glance screen. It has no nav and its own full-bleed layout — keep that. Restyle it onto
the tokens and primitives: the `--color-muted` slab it sits on, the pixel-font heading, the next
action as the same bevel card + small `NEXT` label that Today uses, and the catch-up / rumble /
demo counters as ≥44px tappable rows rather than inline text (`.vmu-cranking` measures 24px
today). Delete `.vmu*` from `theme.css`.

### Demo Discs (`src/screens/Demos.tsx`)

- The grid becomes `Card variant="bevel"` per disc (keeping `class="demo-card"`), with a `Badge`
  for the build state (`ready` → tone `ok`, `building` → `accent`, `failed` → `bad`), the title in
  the body face, and Play / Rebuild as `Button variant="retro"` at ≥44px.
- The failed-build state keeps its exact copy ("This one didn't build.") and its Rebuild button —
  `demos.spec.ts` reads that string.
- **The player at `/demos/:id` stays full-bleed**: the iframe fills the viewport, the floating
  feedback button stays floating, the back control stays where it is. Restyle the chrome only —
  back button, feedback button, feedback panel, the thanks message — onto `Button`, `Textarea` and
  `Card`. Do not change the iframe, its sizing, or anything about how the game is loaded.
- Delete `.demo-*` from `theme.css`.

### Final clean-up

- `Panel.tsx` is now a one-line wrapper over `Card variant="bevel"`. Either delete it and use
  `Card` directly at its remaining call sites (`NotYet.tsx`, and anything unit 2 left), or keep it
  — your call, but do not leave it half-used.
- `theme.css` ends this unit as: the `@import 'tailwindcss'`, the `@theme` token block, the
  `@layer base` block, the two keyframes (`terminal-caret`, `acknowledgement`) and their
  reduced-motion guard, and nothing else. Every `.legacy-class` rule is gone. If a rule survives,
  say in the PR description which element still needs it and why.
- Delete the `lastEvent` value from `src/live/LiveEvents.tsx`'s provider state **only if it is
  genuinely unused**: `subscribe(kind, …)` is how every consumer reads events, and keeping
  `lastEvent` in state forces a re-render of the whole tree on every server-sent event. Grep for it
  first; if anything still reads it, leave it alone and say so.

## Acceptance criteria

- [ ] VMU, the Debug Menu, the Demo Discs grid and the Demo player chrome render entirely through
      the `src/components/ui/` primitives and Tailwind utilities.
- [ ] The Debug Menu is visually unchanged — same tile layout, same dim body-face labels, same
      pixel-font values, same tone-coloured top borders.
- [ ] The Demo player is still full-bleed with a floating feedback button, and the game iframe is
      untouched.
- [ ] `theme.css` contains only tokens, base styles and the two keyframes; no screen-specific class
      rules remain (or the PR says exactly which one survived and why).
- [ ] Every interactive control across the whole Pak measures at least 44×44px at 375px wide.
- [ ] The pixel font appears only on headings, badges, card labels and short accents — no
      sentence-length text in it anywhere in the Pak.
- [ ] No horizontal scrolling at 375px on any screen.
- [ ] No route, accessible name, `aria-*` attribute, visible string or API call changed. The whole
      Playwright suite passes **unchanged** — no spec file edited.
- [ ] `AGENTS.md` conventions followed. No new dependencies.

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

Then look at it in a browser at **375×812** and **1280×900** and attach a screenshot of `/`,
`/quests`, `/rumble`, `/catch-up`, `/demos`, `/demos/main`, `/debug` and `/vmu` at both widths **to
the PR description**. Do not commit screenshots into the repo.

To run it locally, build first, then start the server against a **scratch** factory on a port you
picked programmatically (never 8787, 8788 or 8799):

```bash
pnpm build
FACTORY_DIR=$(mktemp -d) REPO_DIR=$(mktemp -d) PAK_PORT=<free port> \
  PAK_DIST="$PWD/factory/pak/dist" WAKE_URL= WAKE_SECRET= node factory/server/dist/main.js
```

Seed worlds, quests, a rumble, a chain and a demo disc through the API so no screen is empty.

## Out of scope

- `factory/planner/` — never edit it.
- `factory/wake`, `factory/shared`, `factory/server`, `game/`. Touch nothing outside `factory/pak`.
- Restyling the Debug Menu's look, changing the Demo player's layout, or touching the game iframe.
- Any behaviour, copy, route or API change. Any new dependency. Any light theme. Any decorative
  animation. Committing screenshots to the repo.
