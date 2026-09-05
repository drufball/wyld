import { expect, test } from '@playwright/test';

test('routes an arrival through Catch-Up and back to Today', async ({ page, request }) => {
  for (let index = 0; index < 21; index += 1) {
    const response = await request.post('/api/events', {
      data: { source: 'human', kind: 'human.intent', payload: { text: `idea ${index}` } },
    });
    expect(response.ok()).toBe(true);
  }
  const digest = await request.post('/api/catchup', {
    data: {
      digest: {
        rumbles: [{ text: 'Choose the next trail', deepLink: '/rumble' }],
        demos: [],
        shipped: [],
        fyi: [],
      },
    },
  });
  expect(digest.ok()).toBe(true);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Catch-Up' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText('What do we make today?')).toBeVisible();
});
