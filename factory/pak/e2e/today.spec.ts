import { expect, test } from '@playwright/test';

test('submits an intent from Today', async ({ page, request }) => {
  const intent = 'add a field guide screen';
  await page.goto('/');
  await expect(page.getByText('What do we make today?')).toBeVisible();
  const field = page.getByLabel('What do we make today?');
  await field.fill(intent);
  await field.press('Enter');
  await expect(field).toHaveValue('');
  await expect(page.getByText('Got it.')).toBeVisible();
  const response = await request.get('/api/events');
  expect(response.ok()).toBe(true);
  const events = (await response.json()) as Array<{
    source: string;
    kind: string;
    payload: unknown;
  }>;
  expect(events).toContainEqual(
    expect.objectContaining({ source: 'human', kind: 'human.intent', payload: { text: intent } }),
  );
});

test('opens an in-flight quest from Today', async ({ page, request }) => {
  const suffix = Date.now().toString();
  const worldId = `today-world-${suffix}`;
  const questId = `today-quest-${suffix}`;
  const title = `Today quest ${suffix}`;
  const update = 'The trail reaches the river.';
  expect(
    (
      await request.post('/api/worlds', {
        data: { id: worldId, name: 'Today World', kind: 'game', order: 10, icon: 'star' },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post('/api/quests', {
        data: {
          id: questId,
          worldId,
          title,
          pitch: 'Build the trail.',
          status: 'building',
          progress: 0.5,
          sinceYouLooked: update,
          lastNote: '',
        },
      })
    ).ok(),
  ).toBe(true);

  await page.goto('/');
  const card = page.locator('.today-quest').filter({ hasText: title });
  await expect(card.getByText(update)).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(`/quests?quest=${questId}`);
  await expect(page.locator('.quest-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show all quests' })).toBeVisible();
});
