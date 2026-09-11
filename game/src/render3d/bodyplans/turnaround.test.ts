import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { species, type SpeciesData, type SpeciesId } from '../../creatures/species.js';
import { ELEVATION, TILT_FROM_VERTICAL } from '../camera.js';
import {
  formatTurnaroundTable,
  isThin,
  measureObjectSilhouette,
  measureTurnaround,
  PIXELS_PER_TILE,
} from './turnaround.js';

const KNOWN_THIN: readonly SpeciesId[] = [];
const directory = fileURLToPath(new URL('.', import.meta.url));
const verificationPath = fileURLToPath(new URL('../../../VERIFICATION.md', import.meta.url));
const baselinePath = `${directory}turnaround.baseline.json`;

type BaselineEntry = {
  width: number;
  height: number;
  area: number;
  visual: SpeciesData['visual'];
};
type Baseline = Partial<Record<SpeciesId, BaselineEntry>>;

const sameVisual = (data: SpeciesData, entry: BaselineEntry | undefined): boolean =>
  entry !== undefined &&
  data.visual.length === entry.visual.length &&
  data.visual.height === entry.visual.height &&
  data.visual.wingspan === entry.visual.wingspan;

const readBaseline = (): Baseline => JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline;

const updateBaseline = (allSpecies: readonly SpeciesData[]): Baseline => {
  let baseline: Baseline = {};
  try {
    baseline = readBaseline();
  } catch {
    // The update command also creates the baseline on its first run.
  }
  for (const data of allSpecies) {
    if (sameVisual(data, baseline[data.id])) continue;
    const { width, height, area } = measureTurnaround(data).front;
    baseline[data.id] = { width, height, area, visual: { ...data.visual } };
  }
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  return baseline;
};

const expectFrontViewsWithinBaseline = (
  allSpecies: readonly SpeciesData[],
  baseline: Baseline,
): void => {
  for (const data of allSpecies) {
    const entry = baseline[data.id];
    if (!entry || !sameVisual(data, entry)) continue;
    const current = measureTurnaround(data).front;
    for (const field of ['width', 'height', 'area'] as const) {
      expect(current[field], `${data.id} ${field}`).toBeGreaterThanOrEqual(entry[field] * 0.9);
      expect(current[field], `${data.id} ${field}`).toBeLessThanOrEqual(entry[field] * 1.1);
    }
  }
};

const tableRowsFor = (table: string, names: ReadonlySet<string>): string =>
  table
    .split('\n')
    .filter((line, index) => index < 2 || names.has(line.split('|')[1]?.trim() ?? ''))
    .join('\n');

const expectTableMatchesBaselineVisuals = (
  allSpecies: readonly SpeciesData[],
  baseline: Baseline,
  actualTable: string,
): void => {
  const unchanged = allSpecies.filter((data) => sameVisual(data, baseline[data.id]));
  const names = new Set(unchanged.map(({ name }) => name));
  const rows = Object.fromEntries(unchanged.map((data) => [data.id, measureTurnaround(data)]));
  expect(tableRowsFor(actualTable, names)).toBe(formatTurnaroundTable(rows));
};

// Regenerate the checked-in measurements with:
// UPDATE_TURNAROUND=1 pnpm --filter @wyld/game test turnaround
describe('body-plan turnaround', () => {
  it('projects a unit cube at the diorama tilt to the expected footprint', () => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const measured = measureObjectSilhouette(cube);
    expect(Math.abs(measured.width - PIXELS_PER_TILE)).toBeLessThanOrEqual(2);
    expect(
      Math.abs(
        measured.height - PIXELS_PER_TILE * (Math.sin(TILT_FROM_VERTICAL) + Math.sin(ELEVATION)),
      ),
    ).toBeLessThanOrEqual(2);
    cube.geometry.dispose();
  });

  it('renders every species full from the side', () => {
    const thin = species()
      .filter((data) => isThin(measureTurnaround(data)).thin)
      .map(({ id }) => id);
    expect(thin).toEqual(KNOWN_THIN);
  });

  it('keeps every species front view within 10% of the baseline', () => {
    const baseline =
      process.env.UPDATE_TURNAROUND === '1' ? updateBaseline(species()) : readBaseline();
    expectFrontViewsWithinBaseline(species(), baseline);
  });

  it('matches the turnaround table in VERIFICATION.md', () => {
    const rows = new Map(species().map((data) => [data.id, measureTurnaround(data)]));
    const table = formatTurnaroundTable(Object.fromEntries(rows));
    const start = '<!-- turnaround:start -->';
    const end = '<!-- turnaround:end -->';
    const verification = readFileSync(verificationPath, 'utf8');
    const measuredBlock = verification.slice(
      verification.indexOf(start) + start.length,
      verification.indexOf(end),
    );
    if (process.env.UPDATE_TURNAROUND === '1') {
      writeFileSync(
        verificationPath,
        verification.replace(`${start}${measuredBlock}${end}`, `${start}\n${table}\n${end}`),
      );
      updateBaseline(species());
      return;
    }
    expectTableMatchesBaselineVisuals(species(), readBaseline(), measuredBlock.trim());
  });

  it('ignores a species whose shape changed in the workshop', () => {
    const changed = structuredClone(species()[0]!);
    changed.visual.length = changed.visual.length! * 1.3;
    const existingTable = readFileSync(verificationPath, 'utf8');
    const start = '<!-- turnaround:start -->';
    const end = '<!-- turnaround:end -->';
    const table = existingTable.slice(
      existingTable.indexOf(start) + start.length,
      existingTable.indexOf(end),
    );

    const baseline = readBaseline();
    expectFrontViewsWithinBaseline([changed], baseline);
    expectTableMatchesBaselineVisuals([changed], baseline, table.trim());
  });
});
