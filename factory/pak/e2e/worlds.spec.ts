import { expect, test } from '@playwright/test';

test('opens a filtered quest list and nudges its quest', async ({ page, request }) => {
  const suffix = Date.now().toString();
  const worldId = `smoke-world-${suffix}`;
  const questId = `smoke-quest-${suffix}`;
  expect(
    (
      await request.post('/api/worlds', {
        data: {
          id: worldId,
          name: 'Smoke World',
          kind: 'game',
          order: 8,
          icon: 'star',
        },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post('/api/quests', {
        data: {
          id: questId,
          worldId,
          title: 'Smoke Quest',
          pitch: 'Make a trail through the mist.',
          status: 'building',
          sinceYouLooked: '',
          lastNote: '',
        },
      })
    ).ok(),
  ).toBe(true);

  await page.goto(`/worlds/${worldId}`);
  await expect(page).toHaveURL(`/quests?world=${worldId}`);
  await expect(page.getByRole('heading', { name: 'Smoke Quest' })).toBeVisible();
  await expect(page.getByText('Make a trail through the mist.')).toBeVisible();
  await expect(page.getByText('building', { exact: true })).toBeVisible();
  await expect(page.getByRole('article').getByText('Smoke World', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nudge' }).click();

  await expect
    .poll(async () => {
      const events = (await (await request.get('/api/events')).json()) as Array<{
        kind: string;
        questId?: string;
      }>;
      return events.some((event) => event.kind === 'human.nudge' && event.questId === questId);
    })
    .toBe(true);
});
