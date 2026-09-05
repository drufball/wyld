import { expect, test } from '@playwright/test';

test('asks, receives a live answer, and settles a chain', async ({ page, request }) => {
  const question = `What grows in the Wyld? ${Date.now()}`;
  await page.goto('/');
  const field = page.getByLabel("What's on your mind?");
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

test('asks about a quest and keeps its chain in sync with Today', async ({ page, request }) => {
  const suffix = Date.now().toString();
  const worldId = `chain-world-${suffix}`;
  const questId = `chain-quest-${suffix}`;
  const question = `Where should this quest go? ${suffix}`;
  expect(
    (
      await request.post('/api/worlds', {
        data: { id: worldId, name: 'Chain World', kind: 'game', order: 9, icon: 'star' },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post('/api/quests', {
        data: {
          id: questId,
          worldId,
          title: 'Chain Quest',
          pitch: 'Test questions on quests.',
          status: 'building',
          sinceYouLooked: '',
          lastNote: '',
        },
      })
    ).ok(),
  ).toBe(true);

  await page.goto(`/quests?world=${worldId}`);
  const questCard = page.locator('.quest-card').filter({ hasText: 'Chain Quest' });
  await questCard.getByRole('button', { name: 'Ask' }).click();
  const field = questCard.getByLabel('Ask about this quest');
  await field.fill(question);
  await field.press('Enter');
  await expect(questCard.getByText(question)).toBeVisible();
  await expect(questCard.getByRole('button', { name: 'Make this a quest' })).toHaveCount(0);

  await page.goto('/');
  const todayCard = page.locator('.chain-card').filter({ hasText: question });
  await expect(todayCard).toBeVisible();
  await expect(todayCard.getByText('Chain Quest')).toBeVisible();
  const chains = (await (await request.get(`/api/chains?quest=${questId}`)).json()) as Array<{
    id: number;
  }>;
  const answer = 'Take the path through the trees.';
  expect(
    (
      await request.post(`/api/chains/${chains[0]!.id}/messages`, {
        data: { author: 'planner', text: answer },
      })
    ).ok(),
  ).toBe(true);
  await expect(todayCard.getByText(answer)).toBeVisible();

  await page.goto(`/quests?world=${worldId}`);
  await expect(page.getByText(answer)).toBeVisible();
  await page
    .locator('.chain-card')
    .filter({ hasText: question })
    .getByRole('button', { name: 'Settled' })
    .click();
  await expect(page.getByText(question)).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByText(question)).toHaveCount(0);
});
