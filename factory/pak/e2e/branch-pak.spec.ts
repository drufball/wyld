import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const slug = 'branch-check';
const demosDir = process.env.WYLD_E2E_DEMOS_DIR;
if (!demosDir) throw new Error('Missing WYLD_E2E_DEMOS_DIR');
const pakDir = path.resolve(import.meta.dirname, '..');

test.beforeAll(() => {
  const vite = path.join(pakDir, 'node_modules/vite/bin/vite.js');
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-branch-pak-'));
  execFileSync(process.execPath, [vite, 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: pakDir,
    env: { ...process.env, PAK_BASE: `/play/${slug}/` },
  });
  fs.mkdirSync(demosDir, { recursive: true });
  fs.cpSync(outDir, path.join(demosDir, slug), { recursive: true });
});

test('loads a branch Pak bundle without registering a service worker', async ({ page }) => {
  await page.goto(`/play/${slug}/`);

  const branchScript = page.locator(`script[src^="/play/${slug}/"]`);
  await expect(branchScript).toHaveCount(1);
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect
    .poll(() =>
      page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
    )
    .toBe(0);
});
