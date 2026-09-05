import { expect, test } from '@playwright/test';

test('shows a seeded demo disc', async ({ page, request }) => {
  const suffix = Date.now().toString();
  const title = `Moonlit grove ${suffix}`;
  expect(
    (
      await request.post('/api/demos', { data: { id: `demo-e2e-${suffix}`, ref: 'main', title } })
    ).ok(),
  ).toBe(true);
  await page.goto('/demos');
  await expect(page.locator('.demo-card').filter({ hasText: title })).toBeVisible();
});
