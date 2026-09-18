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
  test(
    'the entry and its shared chunks contain no three.js or render3d module',
    { timeout: 60_000 },
    () => {
      const importedChunks = entry().imports.map((fileName) => {
        const chunk = chunks().find((candidate) => candidate.fileName === fileName);
        if (!chunk) throw new Error(`imported chunk not found: ${fileName}`);
        return chunk;
      });
      const flatChunks = [entry(), ...importedChunks];

      for (const chunk of flatChunks) {
        expect(chunk.moduleIds.filter((id) => id.includes('/node_modules/zod/'))).toEqual([]);
        expect(chunk.code).not.toContain('ZodError');
        expect(chunk.moduleIds.some((id) => id.includes('/node_modules/three/'))).toBe(false);
        expect(
          chunk.moduleIds.filter(
            (id) => id.includes('/src/render3d/') && !id.endsWith('/src/render3d/look.ts'),
          ),
        ).toEqual([]);
        expect(chunk.code).not.toContain(threeWarning);
      }
      expect(flatChunks.reduce((size, chunk) => size + chunk.code.length, 0)).toBeLessThan(
        500 * 1024,
      );
    },
  );

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
});
