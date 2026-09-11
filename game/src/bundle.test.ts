import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { build } from 'vite';

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const threeWarning = 'THREE.WebGLRenderer';
type RollupOutput = Extract<Awaited<ReturnType<typeof build>>, { output: unknown }>;
let output: RollupOutput;

beforeAll(async () => {
  const result = await build({
    root: gameRoot,
    configFile: path.join(gameRoot, 'vite.config.ts'),
    logLevel: 'silent',
    build: { write: false, reportCompressedSize: false },
  });
  if (Array.isArray(result) || 'close' in result) {
    throw new Error('expected one non-watcher Rollup output');
  }
  output = result as RollupOutput;
}, 60_000);

const chunks = () => output.output.filter((item) => item.type === 'chunk');
const entry = () => {
  const found = chunks().find((chunk) => chunk.isEntry);
  if (!found) throw new Error('entry chunk not found');
  return found;
};

describe('production bundle', () => {
  test('the entry chunk contains no three.js and no render3d module', { timeout: 60_000 }, () => {
    expect(entry().moduleIds.some((id) => id.includes('/node_modules/three/'))).toBe(false);
    expect(
      entry().moduleIds.filter(
        (id) => id.includes('/src/render3d/') && !id.endsWith('/src/render3d/look.ts'),
      ),
    ).toEqual([]);
    expect(entry().code).not.toContain(threeWarning);
  });

  test(
    'the diorama chunk is a separate dynamic import that carries three.js and render3d',
    { timeout: 60_000 },
    () => {
      const render3dIds = new Set(
        chunks()
          .flatMap((chunk) => chunk.moduleIds)
          .filter((id) => id.includes('/src/render3d/') && !id.endsWith('/src/render3d/look.ts')),
      );
      const candidates = chunks().filter(
        (chunk) =>
          !chunk.isEntry &&
          chunk.moduleIds.some((id) => id.includes('/node_modules/three/')) &&
          [...render3dIds].every((id) => chunk.moduleIds.includes(id)),
      );
      expect(candidates).toHaveLength(1);
      const diorama = candidates[0]!;
      expect(entry().dynamicImports).toContain(diorama.fileName);
      expect(diorama.code).toContain(threeWarning);
    },
  );

  test('the entry chunk is under the 500 kB warning limit', { timeout: 60_000 }, () => {
    // This is the warning threshold Vite prints, not a budget chosen by the game.
    expect(entry().code.length).toBeLessThan(500 * 1024);
  });
});
