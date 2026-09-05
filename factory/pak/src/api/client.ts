import {
  CatchupView,
  Chain,
  Event,
  HealthSnapshot,
  NewEvent,
  Presence,
  Quest,
  QuestNote,
  WorldWithQuestCounts,
  type NewEvent as NewEventType,
  type QuestStatus,
} from '@wyld/shared';
import type { Chain as ChainType } from '@wyld/shared';

async function request(input: string, init: RequestInit, description: string): Promise<unknown> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${description} failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  return response.json();
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

export async function listQuestNotes(id: string) {
  return QuestNote.array().parse(
    await request(`/api/quests/${encodeURIComponent(id)}/notes`, {}, 'Loading notes'),
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

export async function listChains(options: { quest?: string } = {}): Promise<ChainType[]> {
  const params = new URLSearchParams();
  if (options.quest) params.set('quest', options.quest);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return Chain.array().parse(await request(`/api/chains${query}`, {}, 'Loading chains'));
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

export async function closeChain(id: number, reason: 'settled' | 'converted'): Promise<ChainType> {
  return Chain.parse(
    await request(
      `/api/chains/${id}/close`,
      json('POST', { reason, source: 'human' }),
      'Closing chain',
    ),
  );
}
