import type { Chain, Rumble as RumbleType } from '@wyld/shared';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decideRumble, listChains, listRumbles, postChain } from '../api/client.js';
import { Rumble } from './Rumble.js';

vi.mock('../api/client.js', () => ({
  decideRumble: vi.fn(),
  listChains: vi.fn(),
  postChain: vi.fn(),
  postChainMessage: vi.fn(),
  closeChain: vi.fn(),
  listRumbles: vi.fn(),
}));
vi.mock('../live/LiveEvents.js', () => {
  const subscribe = () => () => undefined;
  return { useLiveEvents: () => ({ subscribe }) };
});

const first: RumbleType = {
  id: 'taste-first',
  title: 'First choice',
  context: 'First context',
  options: ['A', 'B'],
  chosen: null,
  chosenAt: null,
  blockingQuestIds: ['quest-one'],
  kind: 'taste',
};
const second: RumbleType = {
  id: 'outage-second',
  title: 'Second choice',
  context: 'Second context',
  options: ['Resume', 'Wait'],
  chosen: null,
  chosenAt: null,
  blockingQuestIds: [],
  kind: 'outage',
};
const decided = (rumble: RumbleType, chosen = rumble.options[0]!): RumbleType => ({
  ...rumble,
  chosen,
  chosenAt: '2026-09-05T12:00:00.000Z',
});

beforeEach(() => {
  vi.mocked(listRumbles).mockReset().mockResolvedValue([]);
  vi.mocked(decideRumble).mockReset();
  vi.mocked(listChains).mockReset().mockResolvedValue([]);
  vi.mocked(postChain).mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('Rumble', () => {
  it('keeps API ordering, decides, and allows a different decision', async () => {
    vi.mocked(listRumbles).mockResolvedValue([first, second]);
    vi.mocked(decideRumble).mockResolvedValue(decided(first, 'A'));
    render(<Rumble />);
    await screen.findByText('First choice');
    const cards = document.querySelectorAll('.rumble-card');
    expect(cards[0]?.textContent).toContain('First choice');
    expect(cards[1]?.textContent).toContain('Second choice');
    await act(async () => {
      fireEvent.click(within(cards[0] as HTMLElement).getByRole('button', { name: 'A' }));
      await Promise.resolve();
    });
    await waitFor(() => expect(decideRumble).toHaveBeenCalledWith(first.id, 'A'));
    const details = await screen.findByText('Already decided (1)');
    fireEvent.click(details);
    vi.mocked(decideRumble).mockResolvedValue(decided(first, 'B'));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    await waitFor(() => expect(decideRumble).toHaveBeenLastCalledWith(first.id, 'B'));
  });

  it('renders the exact empty state', async () => {
    vi.mocked(listRumbles).mockResolvedValue([]);
    render(<Rumble />);
    expect(await screen.findByText("Controller's quiet.")).not.toBeNull();
    expect(screen.queryByText('Already decided (0)')).toBeNull();
  });

  it('offers retry after a failed decision', async () => {
    vi.mocked(listRumbles).mockResolvedValue([first]);
    vi.mocked(decideRumble)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(decided(first));
    render(<Rumble />);
    fireEvent.click(await screen.findByRole('button', { name: 'A' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(decideRumble).toHaveBeenCalledTimes(2));
  });

  it('vibrates when available and works without vibration support', async () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    vi.mocked(listRumbles).mockResolvedValue([first]);
    vi.mocked(decideRumble).mockResolvedValue(decided(first));
    const view = render(<Rumble />);
    fireEvent.click(await screen.findByRole('button', { name: 'A' }));
    await waitFor(() => expect(vibrate).toHaveBeenCalledWith([40, 30, 40]));
    view.unmount();
    vi.stubGlobal('navigator', {});
    render(<Rumble />);
    fireEvent.click(await screen.findByRole('button', { name: 'A' }));
    await waitFor(() => expect(decideRumble).toHaveBeenCalledTimes(2));
  });

  it('asks for more with the title and blocking quest', async () => {
    const chain: Chain = {
      id: 1,
      status: 'open',
      createdAt: '2026-09-05T12:00:00.000Z',
      lastActivityAt: '2026-09-05T12:00:00.000Z',
      questId: 'quest-one',
      messages: [
        { id: 1, chainId: 1, author: 'human', text: 'More?', ts: '2026-09-05T12:00:00.000Z' },
      ],
    };
    vi.mocked(listRumbles).mockResolvedValue([first]);
    vi.mocked(listChains).mockResolvedValue([chain]);
    vi.mocked(postChain).mockResolvedValue(chain);
    render(<Rumble />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ask for more' }));
    fireEvent.change(screen.getByLabelText('What else do you need to know?'), {
      target: { value: 'More detail' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(postChain).toHaveBeenCalledWith('About "First choice": More detail', 'quest-one'),
    );
    expect(await screen.findByText('More?')).not.toBeNull();
  });
});
