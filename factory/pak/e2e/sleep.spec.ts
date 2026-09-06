import { expect, test } from '@playwright/test';

test('shows a sleep run with phases and countdown', async ({ page, request }) => {
  let current = (await (await request.get('/api/sleep/current')).json()) as {
    run: { id: number } | null;
  };
  if (current.run === null) {
    expect((await request.post('/api/sleep/goodnight', { data: { trigger: 'human' } })).ok()).toBe(
      true,
    );
    current = (await (await request.get('/api/sleep/current')).json()) as typeof current;
  }
  expect(current.run).not.toBeNull();
  await request.post(`/api/sleep/${current.run!.id}/phase`, { data: { phase: 'drain' } });
  await page.goto('/sleep');
  await expect(page.getByRole('list', { name: 'Night phases' })).toBeVisible();
  await expect(page.getByText(/to lights on/)).toBeVisible();
  await expect(page.getByText('drain', { exact: true })).toBeVisible();
});
