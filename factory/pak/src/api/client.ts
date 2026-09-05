import {
  Event,
  NewEvent,
  Presence,
  Quest,
  QuestNote,
  WorldWithQuestCounts,
  type NewEvent as NewEventType,
  type QuestStatus,
} from '@wyld/shared';

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

export async function postSeen() {
  return Presence.parse(await request('/api/presence/seen', { method: 'POST' }, 'Recording visit'));
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
