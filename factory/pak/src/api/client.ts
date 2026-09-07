import {
  Achievement,
  Artifact,
  ArtifactWithHtml,
  CatchupView,
  Chain,
  Demo,
  Event,
  Feedback,
  HealthSnapshot,
  NewEvent,
  Presence,
  Quest,
  QuestNote,
  Rumble,
  NewFeedback,
  Retro,
  SleepCurrent,
  SleepRun,
  WorldWithQuestCounts,
  type NewEvent as NewEventType,
  type QuestStatus,
} from '@wyld/shared';
import type { Chain as ChainType } from '@wyld/shared';
import type {
  Demo as DemoType,
  Feedback as FeedbackType,
  NewFeedback as NewFeedbackType,
} from '@wyld/shared';

async function request(input: string, init: RequestInit, description: string): Promise<unknown> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${description} failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  return response.json();
}

export async function listAchievements() {
  return Achievement.array().parse(await request('/api/achievements', {}, 'Loading achievements'));
}

function json(method: 'POST' | 'PATCH', body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function postEvent(newEvent: NewEventType) {
  const body = NewEvent.parse(newEvent);
  return Event.parse(await request('/api/events', json('POST', body), 'Posting event'));
}

export async function getPresence() {
  return Presence.parse(await request('/api/presence', {}, 'Loading presence'));
}

export async function getHealthSnapshot() {
  return HealthSnapshot.parse(await request('/api/health/snapshot', {}, 'Loading factory health'));
}

export async function postResume() {
  return request('/api/resume', json('POST', {}), 'Resuming factory');
}

export async function postSeen() {
  return Presence.parse(await request('/api/presence/seen', { method: 'POST' }, 'Recording visit'));
}

export async function getCatchup() {
  return CatchupView.parse(await request('/api/catchup', {}, 'Loading catch-up'));
}

export async function listWorlds() {
  return WorldWithQuestCounts.array().parse(await request('/api/worlds', {}, 'Loading worlds'));
}

export async function listQuests(options: { world?: string; status?: QuestStatus } = {}) {
  const params = new URLSearchParams();
  if (options.world) params.set('world', options.world);
  if (options.status) params.set('status', options.status);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return Quest.array().parse(await request(`/api/quests${query}`, {}, 'Loading quests'));
}

export async function getQuest(id: string) {
  return Quest.parse(await request(`/api/quests/${encodeURIComponent(id)}`, {}, 'Loading quest'));
}

export async function patchQuestStatus(id: string, status: QuestStatus) {
  return Quest.parse(
    await request(
      `/api/quests/${encodeURIComponent(id)}`,
      json('PATCH', { status, source: 'human' }),
      'Updating quest',
    ),
  );
}

export async function postQuestNote(
  id: string,
  note: { author: 'human'; text: string; intent: 'nudge' | 'ask' },
) {
  return QuestNote.parse(
    await request(
      `/api/quests/${encodeURIComponent(id)}/notes`,
      json('POST', note),
      'Posting note',
    ),
  );
}

export async function listChains(
  options: {
    quest?: string;
    kind?: string;
    status?: 'open' | 'settled' | 'converted' | 'all';
    includeSnoozed?: boolean;
  } = {},
): Promise<ChainType[]> {
  const params = new URLSearchParams();
  if (options.quest) params.set('quest', options.quest);
  if (options.kind) params.set('kind', options.kind);
  if (options.status) params.set('status', options.status);
  if (options.includeSnoozed) params.set('includeSnoozed', '1');
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return Chain.array().parse(await request(`/api/chains${query}`, {}, 'Loading chains'));
}

export async function snoozeChain(id: number, until: string): Promise<ChainType> {
  return Chain.parse(
    await request(`/api/chains/${id}/snooze`, json('POST', { until }), 'Snoozing chain'),
  );
}

export async function unsnoozeChain(id: number): Promise<ChainType> {
  return Chain.parse(
    await request(`/api/chains/${id}/unsnooze`, { method: 'POST' }, 'Unsnoozing chain'),
  );
}

export async function postChain(text: string, questId?: string): Promise<ChainType> {
  return Chain.parse(
    await request(
      '/api/chains',
      json('POST', { text, ...(questId === undefined ? {} : { questId }) }),
      'Posting chain',
    ),
  );
}

export async function postChainMessage(id: number, text: string): Promise<ChainType> {
  return Chain.parse(
    await request(
      `/api/chains/${id}/messages`,
      json('POST', { author: 'human', text }),
      'Posting chain message',
    ),
  );
}

export async function closeChain(
  id: number,
  reason: 'settled' | 'converted' | 'done',
  source: 'human' | 'planner' = 'human',
): Promise<ChainType> {
  return Chain.parse(
    await request(`/api/chains/${id}/close`, json('POST', { reason, source }), 'Closing chain'),
  );
}

export async function reopenChain(id: number): Promise<ChainType> {
  return Chain.parse(
    await request(`/api/chains/${id}/reopen`, json('POST', { source: 'human' }), 'Reopening chain'),
  );
}

export async function decideRumble(id: string, chosen: string) {
  return Rumble.parse(
    await request(
      `/api/rumbles/${encodeURIComponent(id)}/decide`,
      json('POST', { chosen }),
      'Deciding rumble',
    ),
  );
}

export async function buildDemo(id?: string): Promise<DemoType> {
  return Demo.parse(
    await request(
      '/api/demos/build',
      json('POST', id === undefined ? {} : { id }),
      'Building demo',
    ),
  );
}

export async function listFeedback(demo?: string): Promise<FeedbackType[]> {
  const query = demo === undefined ? '' : `?demo=${encodeURIComponent(demo)}`;
  return Feedback.array().parse(await request(`/api/feedback${query}`, {}, 'Loading feedback'));
}

export async function postFeedback(body: NewFeedbackType): Promise<FeedbackType> {
  return Feedback.parse(
    await request('/api/feedback', json('POST', NewFeedback.parse(body)), 'Posting feedback'),
  );
}

export async function getSleepCurrent() {
  return SleepCurrent.parse(await request('/api/sleep/current', {}, 'Loading sleep status'));
}

export async function listSleepRuns(limit = 20) {
  return SleepRun.array().parse(
    await request(`/api/sleep/runs?limit=${limit}`, {}, 'Loading sleep runs'),
  );
}

export async function postGoodnight() {
  return SleepRun.parse(
    await request(
      '/api/sleep/goodnight',
      json('POST', { trigger: 'human' }),
      'Starting sleep mode',
    ),
  );
}

export async function listRetros(limit = 20) {
  return Retro.array().parse(await request(`/api/retros?limit=${limit}`, {}, 'Loading memories'));
}

export async function listArtifacts(options: { quest?: string } = {}) {
  const query = options.quest ? `?quest=${encodeURIComponent(options.quest)}` : '';
  return Artifact.array().parse(await request(`/api/artifacts${query}`, {}, 'Loading explainers'));
}

export async function getArtifact(slug: string) {
  return ArtifactWithHtml.parse(
    await request(`/api/artifacts/${encodeURIComponent(slug)}`, {}, 'Loading explainer'),
  );
}
