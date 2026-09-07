import type { Surface } from '../world/tiles.js';
import type { Phase } from '../world/time.js';
type Colour = readonly [number, number, number];
type SurfaceColours = { base: Colour; detail: Colour; shade: Colour };
type Palette = Record<Surface, SurfaceColours>;
const base: Record<Phase, readonly [Colour, Colour, Colour]> = {
  Dawn: [
    [112, 137, 93],
    [154, 116, 82],
    [52, 61, 66],
  ],
  Day: [
    [116, 157, 91],
    [176, 145, 91],
    [48, 62, 54],
  ],
  Dusk: [
    [113, 105, 78],
    [151, 82, 67],
    [51, 48, 61],
  ],
  Night: [
    [48, 64, 67],
    [69, 66, 76],
    [25, 31, 45],
  ],
};
const offsets: Record<Surface, Colour> = {
  grass: [0, 20, 0],
  fern: [-15, 32, -8],
  water: [-35, 10, 42],
  sand: [43, 27, 4],
  salt: [65, 61, 45],
  rock: [-17, -13, -9],
  ash: [-31, -32, -29],
  vent: [30, -45, -43],
  path: [32, 17, -5],
};
const phases: readonly Phase[] = ['Dawn', 'Day', 'Dusk', 'Night'];
const clamp = (n: number) => Math.round(Math.max(0, Math.min(255, n)));
const colour = (source: Colour, offset: Colour): Colour => [
  clamp(source[0] + offset[0]),
  clamp(source[1] + offset[1]),
  clamp(source[2] + offset[2]),
];
const phasePalette = (phase: Phase): Palette =>
  Object.fromEntries(
    Object.entries(offsets).map(([surface, o]) => {
      const p = base[phase];
      return [surface, { base: colour(p[0], o), detail: colour(p[1], o), shade: colour(p[2], o) }];
    }),
  ) as Palette;
const mix = (a: Colour, b: Colour, t: number): Colour => [
  clamp(a[0] + (b[0] - a[0]) * t),
  clamp(a[1] + (b[1] - a[1]) * t),
  clamp(a[2] + (b[2] - a[2]) * t),
];
const paletteAt = (phase: Phase, progress: number): Palette => {
  const next = phases[(phases.indexOf(phase) + 1) % 4]!;
  const a = phasePalette(phase),
    b = phasePalette(next),
    t = Math.max(0, Math.min(1, progress));
  return Object.fromEntries(
    Object.keys(a).map((s) => {
      const surface = s as Surface;
      let entry = {
        base: mix(a[surface].base, b[surface].base, t),
        detail: mix(a[surface].detail, b[surface].detail, t),
        shade: mix(a[surface].shade, b[surface].shade, t),
      };
      if (phase === 'Night')
        entry = {
          base: mix(entry.base, [70, 92, 140], 0.25),
          detail: mix(entry.detail, [70, 92, 140], 0.25),
          shade: mix(entry.shade, [70, 92, 140], 0.25),
        };
      return [surface, entry];
    }),
  ) as Palette;
};
const paletteKey = (phase: Phase, progress: number): string =>
  `${phase}:${Math.max(0, Math.min(31, Math.floor(progress * 32)))}`;
export { paletteAt, paletteKey };
export type { Colour, Palette, SurfaceColours };
