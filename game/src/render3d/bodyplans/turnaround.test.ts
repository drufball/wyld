import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { species, type SpeciesId } from '../../creatures/species.js';
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
    if (process.env.UPDATE_TURNAROUND === '1') {
      try {
        readFileSync(baselinePath);
      } catch {
        const baseline = Object.fromEntries(
          species().map((data) => {
            const { width, height, area } = measureTurnaround(data).front;
            return [data.id, { width, height, area }];
          }),
        );
        writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
      }
    }
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Record<
      SpeciesId,
      { width: number; height: number; area: number }
    >;
    for (const data of species()) {
      const current = measureTurnaround(data).front;
      for (const field of ['width', 'height', 'area'] as const) {
        expect(current[field], `${data.id} ${field}`).toBeGreaterThanOrEqual(
          baseline[data.id]![field] * 0.9,
        );
        expect(current[field], `${data.id} ${field}`).toBeLessThanOrEqual(
          baseline[data.id]![field] * 1.1,
        );
      }
    }
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
      try {
        readFileSync(baselinePath);
      } catch {
        const baseline = Object.fromEntries(
          species().map((data) => {
            const { width, height, area } = rows.get(data.id)!.front;
            return [data.id, { width, height, area }];
          }),
        );
        writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
      }
      return;
    }
    expect(measuredBlock).toBe(`\n${table}\n`);
  });
});
