import { expect, test } from '@playwright/test';
import { PIN_BRIDGE_SNIPPET } from '../src/lib/pin-bridge.js';

test('runs an interactive explainer in its sandboxed frame', async ({ page, request }) => {
  const slug = `explain-e2e-${Date.now()}`;
  const title = `Explainer ${slug}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Explainer</title></head><body><h1 data-pin="hero">Before</h1><button id="flip" type="button">Flip</button><script>document.getElementById('flip').addEventListener('click',function(){document.querySelector('[data-pin="hero"]').textContent='After';});</script></body></html>`;
  expect(
    (
      await request.post('/api/artifacts', {
        data: { slug, title, summary: 'Interactive explainer', html },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`/explain/${slug}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-pin="hero"]')).toHaveText('Before');
  await frame.getByRole('button', { name: 'Flip' }).click();
  await expect(frame.locator('[data-pin="hero"]')).toHaveText('After');
});

test('pins a comment to an explainer element', async ({ page, request }) => {
  const slug = `pins-e2e-${Date.now()}`;
  const html = `<!doctype html><html><head><title>Pins</title></head><body><h1 data-pin="hero" data-pin-label="Hero title">Hero</h1><p data-pin="detail">Detail</p>${PIN_BRIDGE_SNIPPET}</body></html>`;
  expect(
    (
      await request.post('/api/artifacts', {
        data: { slug, title: 'Pin test', summary: 'Pins', html },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`/explain/${slug}`);
  await page.getByRole('button', { name: 'Pin a comment' }).click();
  await page.frameLocator('iframe').locator('[data-pin="hero"]').click();
  await page.getByRole('dialog', { name: 'Pin a comment' }).getByRole('textbox').fill('Look here');
  await page.getByRole('dialog', { name: 'Pin a comment' }).getByRole('textbox').press('Enter');
  const response = await request.get(`/api/chains?artifact=${encodeURIComponent(slug)}`);
  const chains = await response.json();
  expect(chains).toHaveLength(1);
  expect(chains[0].anchor).toEqual({ artifact: slug, element: 'hero', label: 'Hero title' });
  expect(chains[0].messages[0].text).toBe('Look here');
  await expect(page.getByRole('button', { name: 'Pinned comment 1: Hero title' })).toBeVisible();
});
