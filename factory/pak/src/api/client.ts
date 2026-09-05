import { Event, NewEvent, Presence, type NewEvent as NewEventType } from '@wyld/shared';

async function request(input: string, init: RequestInit, description: string): Promise<unknown> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${description} failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  return response.json();
}

export async function postEvent(newEvent: NewEventType) {
  const body = NewEvent.parse(newEvent);
  return Event.parse(
    await request(
      '/api/events',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      'Posting event',
    ),
  );
}

export async function getPresence() {
  return Presence.parse(await request('/api/presence', {}, 'Loading presence'));
}

export async function postSeen() {
  return Presence.parse(await request('/api/presence/seen', { method: 'POST' }, 'Recording visit'));
}
