import { expect, test } from '@playwright/test';

test('shows a seeded Memory save file', async ({ page, request }) => {
  const suffix = Date.now().toString();
  const date = new Date().toISOString().slice(0, 10);
  const summary = `Night memory ${suffix}`;
  expect(
    (
      await request.put(`/api/retros/${date}`, {
        data: {
          summary,
          wins: [`Win ${suffix}`],
          misses: [],
          factoryImprovements: [],
          stats: { eventsTotal: 9 },
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto('/memory');
  const card = page.locator('section').filter({ hasText: summary });
  await expect(card.getByText(summary)).toBeVisible();
  await expect(card.getByText(`Win ${suffix}`)).toBeVisible();
  await expect(card.getByText('Events')).toBeVisible();
});
