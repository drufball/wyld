import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Memory, humaniseStat } from './Memory.js';

const response = (value: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => value,
    text: async () => '',
  } as Response);
afterEach(() => vi.unstubAllGlobals());
describe('Memory', () => {
  it('renders locked and unlocked achievement tiles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        response(
          url === '/api/achievements'
            ? [
                {
                  id: 'one',
                  name: 'First Light',
                  description: 'Done',
                  badge: '✨',
                  unlockedAt: '2026-09-06T08:00:00Z',
                },
                {
                  id: 'two',
                  name: 'Five Alive',
                  description: 'Locked',
                  badge: '🖐️',
                  unlockedAt: null,
                },
              ]
            : [],
        ),
      ),
    );
    render(<Memory />);
    expect(await screen.findByLabelText('First Light, unlocked')).not.toBeNull();
    expect(screen.getByText('✨')).not.toBeNull();
    const unlockedDate = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
    }).format(new Date('2026-09-06T08:00:00Z'));
    expect(screen.getByLabelText('First Light, unlocked').textContent).toContain(unlockedDate);
    expect(screen.getByLabelText('Five Alive, locked').textContent).toContain('???');
    expect(screen.getByLabelText('Five Alive, locked').querySelector('time')).toBeNull();
  });
  it('renders save data and resolves improvement titles', async () => {
    const retro = {
      id: 1,
      date: '2026-09-06',
      summary: 'A useful night.',
      wins: ['Fast build'],
      misses: ['Slow test'],
      factoryImprovements: ['better-tools', 'unknown-tool'],
      stats: { eventsTotal: 7, customCount: 2 },
      generatedBy: 'planner',
      createdAt: '2026-09-06T08:00:00Z',
      updatedAt: '2026-09-06T08:00:00Z',
    };
    const quest = {
      id: 'better-tools',
      worldId: 'factory',
      title: 'Better tools',
      pitch: 'Improve them',
      status: 'idea',
      progress: 0,
      sinceYouLooked: '',
      lastNote: '',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => response(url === '/api/quests' ? [quest] : [retro])),
    );
    render(<Memory />);
    expect(await screen.findByText('A useful night.')).not.toBeNull();
    expect(screen.getByText('Better tools')).not.toBeNull();
    expect(screen.getByText('unknown-tool')).not.toBeNull();
    expect(screen.queryByText('better-tools')).toBeNull();
    expect(screen.getByText('Events')).not.toBeNull();
  });
  it('has an honest empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([])),
    );
    render(<Memory />);
    expect(await screen.findByText('No nights have been recorded yet.')).not.toBeNull();
  });
  it('shows retros with id fallbacks when quest titles fail', async () => {
    const retro = {
      id: 1,
      date: '2026-09-06',
      summary: 'Still remembered.',
      wins: [],
      misses: [],
      factoryImprovements: ['unknown-tool'],
      stats: {},
      generatedBy: 'planner',
      createdAt: '2026-09-06T08:00:00Z',
      updatedAt: '2026-09-06T08:00:00Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/api/quests' ? Promise.reject(new Error('offline')) : response([retro]),
      ),
    );
    render(<Memory />);
    expect(await screen.findByText('Still remembered.')).not.toBeNull();
    expect(screen.getByText('unknown-tool')).not.toBeNull();
  });
  it('shows an error when retros fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    render(<Memory />);
    expect(await screen.findByText("Memory couldn't load. Try again.")).not.toBeNull();
  });
  it('humanises generic stats', () => expect(humaniseStat('customCount')).toBe('Custom Count'));
});
