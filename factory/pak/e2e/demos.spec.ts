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
  const card = page.locator('.demo-card').filter({ hasText: title });
  await expect(card).toBeVisible();
  await expect(card.getByText("This one didn't build.")).toBeVisible();
});
