import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpeciesData } from '@wyld/sprites';

const { listSpecies, shipSpecies, putSpeciesDraft, deleteSpeciesDraft } = vi.hoisted(() => ({
  listSpecies: vi.fn(),
  shipSpecies: vi.fn(),
  putSpeciesDraft: vi.fn(),
  deleteSpeciesDraft: vi.fn(),
}));
vi.mock('../api/client.js', () => ({
  listSpecies,
  shipSpecies,
  putSpeciesDraft,
  deleteSpeciesDraft,
}));
vi.mock('../components/SpriteCanvas.js', () => ({
  SpriteCanvas: ({ facing, label }: { facing: string; label: string }) => (
    <div role="img" aria-label={label} data-facing={facing} />
  ),
}));

import { Workshop } from './Workshop.js';

const first: SpeciesData = {
  id: 'loamox',
  name: 'Loamox',
  rarity: 'standing',
  tier: 1,
  bodyPlan: 'heavy-quadruped',
  hide: 'Bark',
  innate: ['Scale'],
  forces: ['Impact'],
  stats: { vigor: [40, 60], power: [2, 4], speed: [3, 5], focus: [30, 45] },
  temperament: { Bold: 0.6, Steady: 0.4 },
  habitat: [{ region: 'grove', phases: ['Dawn', 'Day'] }],
  signatureMoves: [{ name: 'Root Rush', delivery: 'Lunge', force: 'Impact', power: 4, speed: 3 }],
  tracks: { kind: 'prints', toes: 4, stride: 1.2 },
  hints: { tracks: 'Deep prints', call: 'Low song', identified: 'Mossy horns' },
  call: {
    waveform: 'triangle',
    notes: [
      { freq: 100, dur: 0.2 },
      { freq: 120, dur: 0.2 },
    ],
    noise: 0.2,
  },
  palette: { primary: '#112233', secondary: '#445566', accent: '#778899' },
  visual: { horns: 1 },
};
const second: SpeciesData = {
  ...first,
  id: 'skyfin',
  name: 'Skyfin',
  tier: 3,
  bodyPlan: 'avian',
  hide: 'Scale',
  stats: { vigor: [350, 400], power: [8, 9], speed: [4, 6], focus: [80, 90] },
};
const regions = [{ id: 'grove', name: 'Verdant Grove', biome: 'woods' }];

describe('Workshop', () => {
  beforeEach(() => {
    listSpecies.mockReset();
    shipSpecies.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders a card for all thirteen species', async () => {
    listSpecies.mockResolvedValue({
      species: Array.from({ length: 13 }, (_, index) => ({
        ...first,
        id: `species-${index}`,
        name: `Creature ${index + 1}`,
      })),
      regions,
    });
    render(<Workshop />);
    expect(await screen.findAllByRole('listitem')).toHaveLength(13);
  });

  it('selects the first species on load', async () => {
    listSpecies.mockResolvedValue({ species: [first, second], regions });
    render(<Workshop />);
    expect(
      (await screen.findByRole('button', { name: /Loamox/ })).getAttribute('aria-current'),
    ).toBe('true');
  });

  it('shows every detail field for the selected species', async () => {
    listSpecies.mockResolvedValue({ species: [first, second], regions });
    render(<Workshop />);
    const heading = await screen.findByRole('heading', { name: 'Loamox' });
    const details = heading.closest('section')?.textContent ?? '';
    for (const text of [
      'vigor: 40–60 band 40–80',
      'power: 2–4 band 2–4',
      'speed: 3–5 band 3–7',
      'focus: 30–45 band 30–50',
      'Bark · Weak to Heat · Resists Cut',
      'heavy-quadruped',
      'Strike',
      'Lunge',
      'Sweep',
      'Scale',
      'Bold 0.6 · Steady 0.4',
      'Verdant Grove · Dawn, Day',
      'Root Rush · power 4 · speed 3',
      'Impact',
      'prints · toes 4 · stride 1.2',
      'triangle · 2 notes · noise 0.2',
      'Tracks: Deep prints',
      'Call: Low song',
      'Identified: Mossy horns',
      'primary #112233',
      'secondary #445566',
      'accent #778899',
    ]) {
      expect(details).toContain(text);
    }
  });

  it('switches the detail to another species when its card is pressed', async () => {
    listSpecies.mockResolvedValue({ species: [first, second], regions });
    render(<Workshop />);
    fireEvent.click(await screen.findByRole('button', { name: /Skyfin/ }));
    expect(screen.getByRole('heading', { name: 'Skyfin' })).not.toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('changes the sprite facing from the detail controls', async () => {
    listSpecies.mockResolvedValue({ species: [first, second], regions });
    render(<Workshop />);
    fireEvent.click(await screen.findByRole('button', { name: 'Side' }));
    expect(
      screen.getByRole('img', { name: 'Loamox detail sprite' }).getAttribute('data-facing'),
    ).toBe('side');
  });

  it('shows a plain-English message when the species data cannot be read', async () => {
    listSpecies.mockRejectedValue(new Error('offline'));
    render(<Workshop />);
    await waitFor(() =>
      expect(
        screen.getByText("The workshop couldn't read the creature data. Try again."),
      ).not.toBeNull(),
    );
  });

  it('shows what would ship and lets you ship it', async () => {
    listSpecies.mockResolvedValue({
      species: [first],
      regions,
      drafts: [
        {
          speciesId: first.id,
          state: 'edited',
          data: { ...first, name: 'Loamox Prime' },
          updatedAt: 'now',
        },
      ],
      references: {},
    });
    shipSpecies.mockResolvedValue({ shipped: false, problems: ['Still testing'] });
    render(<Workshop />);
    expect(await screen.findByText('1 species changed')).not.toBeNull();
    expect(screen.getByText('Loamox Prime — name')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ship' }));
    await waitFor(() => expect(shipSpecies).toHaveBeenCalled());
  });

  it('shows the failing rule in plain English and keeps the draft', async () => {
    listSpecies.mockResolvedValue({
      species: [first],
      regions,
      drafts: [
        {
          speciesId: first.id,
          state: 'edited',
          data: { ...first, name: 'Loamox Prime' },
          updatedAt: 'now',
        },
      ],
      references: {},
    });
    shipSpecies.mockResolvedValue({
      shipped: false,
      problems: ['Loamox vigor is outside its tier band'],
    });
    render(<Workshop />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ship' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Loamox vigor is outside its tier band',
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Ship' }).disabled).toBe(false);
  });

  it('says it shipped and clears the bar', async () => {
    listSpecies
      .mockResolvedValueOnce({
        species: [first],
        regions,
        drafts: [
          {
            speciesId: first.id,
            state: 'edited',
            data: { ...first, name: 'Loamox Prime' },
            updatedAt: 'now',
          },
        ],
        references: {},
      })
      .mockResolvedValueOnce({ species: [first], regions, drafts: [], references: {} });
    shipSpecies.mockResolvedValue({
      shipped: true,
      summary: { added: [], removed: [], changed: [{ id: first.id, fields: [] }] },
      prUrl: 'https://example.invalid/change',
    });
    render(<Workshop />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ship' }));
    expect(await screen.findByText("Shipped. It'll be in the next disc.")).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Ship' })).toBeNull();
  });

  it('never shows a branch, a pull request or CI wording', async () => {
    listSpecies.mockResolvedValue({
      species: [first],
      regions,
      drafts: [
        {
          speciesId: first.id,
          state: 'edited',
          data: { ...first, name: 'Loamox Prime' },
          updatedAt: 'now',
        },
      ],
      references: {},
    });
    render(<Workshop />);
    await screen.findByText('1 species changed');
    expect(document.body.textContent).not.toMatch(/\b(?:PR|branch|CI)\b|pull request|github\.com/i);
  });
});
