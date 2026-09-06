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
  it('humanises generic stats', () => expect(humaniseStat('customCount')).toBe('Custom Count'));
});
