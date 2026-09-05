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
