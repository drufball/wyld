import { expect, test } from '@playwright/test';

test('decides a rumble', async ({ page, request }) => {
  const suffix = Date.now().toString();
  const id = `rumble-e2e-${suffix}`;
  expect(
    (
      await request.post('/api/rumbles', {
        data: {
          id,
          title: `Choose a trail ${suffix}`,
          context: 'Only Dru can choose.',
          options: ['North', 'South'],
          blockingQuestIds: [],
          kind: 'taste',
        },
      })
    ).ok(),
  ).toBe(true);

  await page.goto('/rumble');
  const card = page.locator('.rumble-card').filter({ hasText: `Choose a trail ${suffix}` });
  await card.getByRole('button', { name: 'North', exact: true }).click();

  await expect
    .poll(async () => {
      const response = await request.get('/api/rumbles?status=decided');
      const rumbles = (await response.json()) as Array<{ id: string; chosen: string | null }>;
      return rumbles.find((rumble) => rumble.id === id)?.chosen;
    })
    .toBe('North');
  await expect
    .poll(async () => {
      const response = await request.get('/api/events');
      const events = (await response.json()) as Array<{ kind: string; payload: unknown }>;
      return events.some(
        (event) =>
          event.kind === 'human.decision' &&
          (event.payload as { rumbleId?: string }).rumbleId === id,
      );
    })
    .toBe(true);
});
