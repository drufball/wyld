import { expect, test } from '@playwright/test';

test('asks, receives a live answer, and settles a chain', async ({ page, request }) => {
  const question = `What grows in the Wyld? ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Just asking?' }).click();
  const field = page.getByLabel('What do you want to know?');
  await field.fill(question);
  await field.press('Enter');
  const card = page.locator('.chain-card').filter({ hasText: question });
  await expect(card).toBeVisible();

  const chainsResponse = await request.get('/api/chains');
  expect(chainsResponse.ok()).toBe(true);
  const chains = (await chainsResponse.json()) as Array<{
    id: number;
    messages: Array<{ text: string }>;
  }>;
  const chain = chains.find(({ messages }) => messages[0]?.text === question);
  expect(chain).toBeDefined();
  const answer = 'Something strange and green.';
  const answerResponse = await request.post(`/api/chains/${chain!.id}/messages`, {
    data: { author: 'planner', text: answer },
  });
  expect(answerResponse.ok()).toBe(true);
  await expect(card.getByText(answer)).toBeVisible();

  await card.getByRole('button', { name: 'Settled' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(question)).toHaveCount(0);
});
