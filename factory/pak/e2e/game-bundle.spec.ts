import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const gameDist = path.join(repoRoot, 'game/dist');
const demoDist = path.join(process.env.WYLD_E2E_DEMOS_DIR!, 'bundle-check');

test.use({
  launchOptions: {
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
  viewport: { width: 375, height: 812 },
});

test.beforeAll(() => {
  if (!fs.existsSync(path.join(gameDist, 'index.html'))) {
    throw new Error('build the game first: pnpm --filter "@wyld/game..." build');
  }
  fs.cpSync(gameDist, demoDist, { recursive: true });
  const indexPath = path.join(demoDist, 'index.html');
  fs.writeFileSync(
    indexPath,
    fs.readFileSync(indexPath, 'utf8').replaceAll('="/assets/', '="/play/bundle-check/assets/'),
  );
  for (const file of fs.readdirSync(path.join(demoDist, 'assets'))) {
    if (!file.endsWith('.js')) continue;
    const assetPath = path.join(demoDist, 'assets', file);
    fs.writeFileSync(
      assetPath,
      fs.readFileSync(assetPath, 'utf8').replaceAll('"/assets/', '"/play/bundle-check/assets/'),
    );
  }
});

const gameUrl = (query: string) => `/play/bundle-check/?${query}`;
const scriptPath = (url: string) => new URL(url).pathname;
const isBundleBoundary = (url: string) =>
  /\/play\/bundle-check\/assets\/(?:index|diorama)-/.test(url);
const relevantPageErrors = (pageErrors: Error[]) =>
  pageErrors.filter((error) => /import|three/i.test(error.message));

test('the flat look loads one script and never requests the diorama chunk', async ({ page }) => {
  const scripts: string[] = [];
  const pageErrors: Error[] = [];
  page.on('request', (request) => {
    const pathname = scriptPath(request.url());
    if (request.resourceType() === 'script' && isBundleBoundary(pathname)) scripts.push(pathname);
  });
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto(gameUrl('look=flat&scenario=arena&debug=1&seed=1'));
  await page.waitForFunction(() => window.__wyld !== undefined);
  await page.waitForTimeout(1_000);

  expect(scripts).toHaveLength(1);
  expect(scripts[0]).toMatch(/^\/play\/bundle-check\/assets\/index-/);
  expect(scripts.some((url) => url.includes('diorama-'))).toBe(false);
  expect(relevantPageErrors(pageErrors)).toEqual([]);
});

test('the diorama look requests the diorama chunk after the entry', async ({ page, request }) => {
  const scripts: string[] = [];
  page.on('request', (resource) => {
    const pathname = scriptPath(resource.url());
    if (resource.resourceType() === 'script' && isBundleBoundary(pathname)) scripts.push(pathname);
  });

  await page.goto(gameUrl('look=diorama&scenario=arena&debug=1&seed=1'));
  await page.waitForFunction(() => window.__wyld !== undefined);

  expect(scripts).toHaveLength(2);
  expect(scripts[0]).toMatch(/^\/play\/bundle-check\/assets\/index-.*\.js$/);
  expect(scripts[1]).toMatch(/^\/play\/bundle-check\/assets\/diorama-.*\.js$/);
  const [entryBody, dioramaBody] = await Promise.all(
    scripts.map(async (url) => (await request.get(url)).text()),
  );
  expect(entryBody).not.toContain('THREE.WebGLRenderer');
  expect(dioramaBody).toContain('THREE.WebGLRenderer');
});

test('the default look is diorama and loads the chunk too', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    const pathname = scriptPath(request.url());
    if (request.resourceType() === 'script' && isBundleBoundary(pathname)) scripts.push(pathname);
  });

  await page.goto(gameUrl('scenario=arena&debug=1&seed=1'));
  await page.waitForFunction(() => window.__wyld !== undefined);

  expect(scripts.some((url) => /\/assets\/diorama-.*\.js$/.test(url))).toBe(true);
});
