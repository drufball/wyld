import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const demoDist = path.join(process.env.WYLD_E2E_DEMOS_DIR!, 'bundle-check');

test.use({
  launchOptions: {
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
  viewport: { width: 375, height: 812 },
});

test.beforeAll(() => {
  execFileSync(
    'pnpm',
    ['--filter', '@wyld/game', 'exec', 'vite', 'build', '--outDir', demoDist, '--emptyOutDir'],
    {
      cwd: repoRoot,
      env: { ...process.env, GAME_BASE: '/play/bundle-check/' },
      stdio: 'pipe',
    },
  );
}, 120_000);

const gameUrl = (query: string) => `/play/bundle-check/?${query}`;
const scriptPath = (url: string) => new URL(url).pathname;
const isGameScript = (url: string) => /\/play\/bundle-check\/assets\/[^/]+\.js$/.test(url);
const relevantPageErrors = (pageErrors: Error[]) =>
  pageErrors.filter((error) => /import|three/i.test(error.message));

test('the flat look never requests the diorama chunk', async ({ page, request }) => {
  const scripts: string[] = [];
  const pageErrors: Error[] = [];
  page.on('request', (request) => {
    const pathname = scriptPath(request.url());
    if (request.resourceType() === 'script' && isGameScript(pathname)) scripts.push(pathname);
  });
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto(gameUrl('look=flat&scenario=arena&debug=1&seed=1'));
  await page.waitForFunction(() => window.__wyld !== undefined);
  await page.waitForTimeout(1_000);

  expect(scripts).toHaveLength(2);
  expect(scripts.filter((url) => /\/index-.*\.js$/.test(url))).toHaveLength(1);
  expect(scripts.filter((url) => !/\/index-.*\.js$/.test(url))).toHaveLength(1);
  expect(scripts.some((url) => url.includes('diorama-'))).toBe(false);
  const bodies = await Promise.all(scripts.map(async (url) => (await request.get(url)).text()));
  expect(bodies.every((body) => !body.includes('THREE.WebGLRenderer'))).toBe(true);
  expect(relevantPageErrors(pageErrors)).toEqual([]);
});

test('the diorama look requests the diorama chunk after the entry and shared chunk', async ({
  page,
  request,
}) => {
  const scripts: string[] = [];
  page.on('request', (resource) => {
    const pathname = scriptPath(resource.url());
    if (resource.resourceType() === 'script' && isGameScript(pathname)) scripts.push(pathname);
  });

  await page.goto(gameUrl('look=diorama&scenario=arena&debug=1&seed=1'));
  await page.waitForFunction(() => window.__wyld !== undefined);

  expect(scripts).toHaveLength(3);
  expect(scripts[0]).toMatch(/^\/play\/bundle-check\/assets\/index-.*\.js$/);
  expect(scripts[1]).not.toMatch(/\/diorama-.*\.js$/);
  expect(scripts.at(-1)).toMatch(/^\/play\/bundle-check\/assets\/diorama-.*\.js$/);
  const bodies = await Promise.all(scripts.map(async (url) => (await request.get(url)).text()));
  expect(bodies.slice(0, -1).every((body) => !body.includes('THREE.WebGLRenderer'))).toBe(true);
  expect(bodies.at(-1)).toContain('THREE.WebGLRenderer');
});

test('the default look is diorama and loads the chunk too', async ({ page, request }) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    const pathname = scriptPath(request.url());
    if (request.resourceType() === 'script' && isGameScript(pathname)) scripts.push(pathname);
  });

  await page.goto(gameUrl('scenario=arena&debug=1&seed=1'));
  await page.waitForFunction(() => window.__wyld !== undefined);

  expect(scripts).toHaveLength(3);
  expect(scripts[0]).toMatch(/^\/play\/bundle-check\/assets\/index-.*\.js$/);
  expect(scripts[1]).not.toMatch(/\/diorama-.*\.js$/);
  expect(scripts.at(-1)).toMatch(/^\/play\/bundle-check\/assets\/diorama-.*\.js$/);
  const bodies = await Promise.all(scripts.map(async (url) => (await request.get(url)).text()));
  expect(bodies.slice(0, -1).every((body) => !body.includes('THREE.WebGLRenderer'))).toBe(true);
  expect(bodies.at(-1)).toContain('THREE.WebGLRenderer');
});
