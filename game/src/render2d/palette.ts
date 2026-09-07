import type { Surface } from '../world/tiles.js';
import type { Phase } from '../world/time.js';
type Colour = readonly [number, number, number];
type SurfaceColours = { base: Colour; detail: Colour; shade: Colour };
type Palette = Record<Surface, SurfaceColours>;
const c = (base: Colour, detail: Colour, shade: Colour): SurfaceColours => ({
  base,
  detail,
  shade,
});
const authored: Record<Phase, Palette> = {
  Dawn: {
    grass: c([91, 133, 72], [132, 164, 90], [48, 75, 48]),
    fern: c([65, 119, 61], [102, 157, 75], [35, 66, 43]),
    water: c([48, 112, 157], [91, 157, 188], [27, 65, 105]),
    sand: c([194, 161, 102], [224, 192, 128], [126, 96, 63]),
    salt: c([221, 215, 184], [245, 238, 208], [151, 143, 131]),
    tree: c([48, 98, 50], [75, 132, 61], [27, 54, 36]),
    rock: c([105, 102, 96], [139, 132, 117], [57, 58, 61]),
    cliff: c([91, 83, 77], [127, 111, 95], [48, 45, 49]),
    ash: c([55, 54, 57], [84, 77, 73], [29, 29, 34]),
    vent: c([104, 47, 39], [211, 105, 53], [42, 27, 31]),
    path: c([156, 126, 82], [190, 155, 101], [91, 71, 53]),
  },
  Day: {
    grass: c([92, 153, 66], [143, 190, 82], [45, 87, 42]),
    fern: c([55, 130, 56], [91, 177, 68], [29, 75, 38]),
    water: c([35, 116, 181], [76, 174, 218], [20, 67, 127]),
    sand: c([210, 177, 105], [239, 207, 136], [137, 104, 62]),
    salt: c([232, 229, 199], [252, 248, 222], [161, 156, 137]),
    tree: c([39, 108, 46], [65, 150, 58], [21, 63, 32]),
    rock: c([111, 112, 108], [151, 150, 137], [61, 64, 66]),
    cliff: c([95, 91, 84], [135, 126, 108], [50, 50, 52]),
    ash: c([49, 49, 51], [78, 73, 69], [24, 26, 30]),
    vent: c([117, 43, 31], [232, 104, 40], [45, 24, 26]),
    path: c([174, 139, 82], [207, 170, 104], [100, 78, 49]),
  },
  Dusk: {
    grass: c([102, 105, 57], [151, 126, 68], [49, 52, 45]),
    fern: c([72, 94, 51], [112, 124, 60], [37, 48, 42]),
    water: c([50, 78, 128], [92, 111, 157], [29, 43, 84]),
    sand: c([174, 126, 80], [211, 151, 93], [103, 72, 57]),
    salt: c([194, 178, 157], [222, 202, 179], [128, 114, 112]),
    tree: c([52, 76, 42], [81, 101, 48], [28, 39, 37]),
    rock: c([95, 84, 84], [129, 105, 98], [51, 45, 57]),
    cliff: c([81, 70, 73], [116, 88, 83], [42, 38, 50]),
    ash: c([49, 43, 49], [79, 57, 56], [24, 25, 36]),
    vent: c([103, 38, 35], [206, 76, 43], [40, 23, 34]),
    path: c([145, 99, 68], [181, 120, 77], [84, 57, 53]),
  },
  Night: {
    grass: c([42, 61, 49], [61, 79, 56], [22, 31, 38]),
    fern: c([34, 55, 45], [49, 72, 51], [18, 29, 36]),
    water: c([25, 49, 91], [45, 75, 121], [14, 26, 62]),
    sand: c([81, 74, 68], [105, 94, 79], [43, 40, 51]),
    salt: c([112, 111, 108], [139, 136, 126], [65, 65, 77]),
    tree: c([27, 45, 37], [40, 61, 42], [14, 24, 31]),
    rock: c([61, 62, 67], [81, 80, 82], [31, 34, 47]),
    cliff: c([52, 52, 59], [72, 69, 69], [27, 29, 42]),
    ash: c([31, 34, 42], [47, 46, 49], [16, 20, 31]),
    vent: c([67, 34, 39], [139, 65, 48], [28, 22, 34]),
    path: c([72, 64, 59], [94, 81, 67], [38, 35, 47]),
  },
};
const phases: readonly Phase[] = ['Dawn', 'Day', 'Dusk', 'Night'];
const clamp = (n: number) => Math.round(Math.max(0, Math.min(255, n)));
const mix = (a: Colour, b: Colour, t: number): Colour => [
  clamp(a[0] + (b[0] - a[0]) * t),
  clamp(a[1] + (b[1] - a[1]) * t),
  clamp(a[2] + (b[2] - a[2]) * t),
];
const moon: Colour = [70, 92, 140];
const paletteAt = (phase: Phase, progress: number): Palette => {
  const t = Math.max(0, Math.min(1, progress)),
    next = phases[(phases.indexOf(phase) + 1) % 4]!,
    tint = phase === 'Dusk' ? t * 0.25 : phase === 'Night' ? (1 - t) * 0.25 : 0;
  return Object.fromEntries(
    Object.keys(authored[phase]).map((name) => {
      const surface = name as Surface,
        a = authored[phase][surface],
        b = authored[next][surface];
      const blend = (field: keyof SurfaceColours) => mix(mix(a[field], b[field], t), moon, tint);
      return [surface, { base: blend('base'), detail: blend('detail'), shade: blend('shade') }];
    }),
  ) as Palette;
};
const paletteKey = (phase: Phase, progress: number): string =>
  `${phase}:${Math.max(0, Math.min(31, Math.floor(progress * 32)))}`;
export { paletteAt, paletteKey };
export type { Colour, Palette, SurfaceColours };
