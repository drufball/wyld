import { expect, test } from '@playwright/test';

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
