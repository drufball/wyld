import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpeciesData, SpeciesDraft, SpeciesLibrary } from '@wyld/sprites';

const api = vi.hoisted(() => ({
  listSpecies: vi.fn(),
  putSpeciesDraft: vi.fn(),
  deleteSpeciesDraft: vi.fn(),
}));
vi.mock('../api/client.js', () => api);
vi.mock('./SpriteCanvas.js', () => ({
  SpriteCanvas: ({ spec, label }: { spec: SpeciesData; label: string }) => (
    <div role="img" aria-label={label} data-primary={spec.palette.primary} />
  ),
}));

import { Workshop } from '../screens/Workshop.js';
import { SpeciesEditor } from './SpeciesEditor.js';

const species: SpeciesData = {
  id: 'testling',
  name: 'Testling',
  rarity: 'standing',
  tier: 1,
  bodyPlan: 'avian',
  hide: 'Bark',
  innate: [],
  forces: ['Cut'],
  stats: { vigor: [40, 50], power: [2, 3], speed: [4, 5], focus: [30, 40] },
  temperament: { Bold: 1 },
  habitat: [{ region: 'grove', phases: ['Day'] }],
  signatureMoves: [{ name: 'Peck', delivery: 'Lunge', force: 'Cut', power: 2, speed: 4 }],
  tracks: { kind: 'feather' },
  hints: { tracks: 'Soft marks', call: 'Bright cry', identified: 'Small wings' },
  call: { waveform: 'sine', notes: [{ freq: 440, dur: 0.2 }] },
  palette: { primary: '#112233', secondary: '#445566' },
  visual: { length: 1, height: 1 },
};
const regions = [{ id: 'grove', name: 'Test Grove', biome: 'woods' }];
const library = (overrides: Partial<SpeciesLibrary> = {}): SpeciesLibrary => ({
  species: [species],
  regions,
  drafts: [],
  references: { testling: [] },
  ...overrides,
});
const editor = (overrides: Partial<React.ComponentProps<typeof SpeciesEditor>> = {}) =>
  render(
    <SpeciesEditor
      spec={species}
      regions={regions}
      all={[species]}
      references={[]}
      isNew={false}
      onChange={vi.fn()}
      onDiscard={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );
const saved = (data: SpeciesData, state: SpeciesDraft['state'] = 'edited'): SpeciesDraft => ({
  speciesId: data.id,
  state,
  data,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('SpeciesEditor', () => {
  beforeEach(() => {
    vi.useRealTimers();
    api.listSpecies.mockReset();
    api.putSpeciesDraft.mockReset();
    api.deleteSpeciesDraft.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows the tier band beside each stat and flags a value outside it', () => {
    editor({ spec: { ...species, stats: { ...species.stats, vigor: [1, 50] } } });
    expect(screen.getByText('vigor: 1–50 band 40–80')).not.toBeNull();
    expect(screen.getByLabelText('vigor minimum').getAttribute('aria-invalid')).toBe('true');
  });

  it('offers only the deliveries the body plan allows', () => {
    editor();
    const options = [...screen.getByLabelText('Move 1 delivery').querySelectorAll('option')].map(
      (option) => option.textContent,
    );
    expect(options).toEqual(['Bolt', 'Arc', 'Lunge']);
  });

  it('reports the hint rule verdict as you type', () => {
    editor();
    fireEvent.change(screen.getByLabelText('tracks hint'), { target: { value: 'At Test Grove' } });
    expect(screen.getByText('names a region: Test Grove')).not.toBeNull();
  });

  it('says ready to ship when every rule passes', () => {
    editor();
    expect(screen.getByRole('status').textContent).toContain('Ready to ship');
  });

  it('round-trips a draft through the server', async () => {
    api.listSpecies.mockResolvedValue(library());
    api.putSpeciesDraft.mockImplementation(async ({ data }: { data: SpeciesData }) => saved(data));
    render(<Workshop />);
    const name = await screen.findByLabelText('Name');
    vi.useFakeTimers();
    fireEvent.change(name, { target: { value: 'Changed' } });
    await vi.advanceTimersByTimeAsync(500);
    expect(api.putSpeciesDraft).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Changed' }) }),
    );
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Changed');
    vi.useRealTimers();
  });

  it('redraws the sprite when the palette changes', () => {
    editor();
    fireEvent.change(screen.getByLabelText('primary hex'), { target: { value: '#abcdef' } });
    expect(
      screen.getByRole('img', { name: 'Testling detail sprite' }).getAttribute('data-primary'),
    ).toBe('#abcdef');
  });

  it('creates a new species as a copy with a fresh id', async () => {
    api.listSpecies.mockResolvedValue(
      library({ drafts: [saved({ ...species, id: 'testling-copy' }, 'new')] }),
    );
    api.putSpeciesDraft.mockImplementation(async ({ data }: { data: SpeciesData }) =>
      saved(data, 'new'),
    );
    render(<Workshop />);
    fireEvent.click(await screen.findByRole('button', { name: 'New species' }));
    await waitFor(() => expect(api.putSpeciesDraft).toHaveBeenCalled());
    expect(api.putSpeciesDraft.mock.calls[0]![0].data.id).toBe('testling-copycopy');
  });

  it('disables delete for a referenced species and names the files', () => {
    editor({ references: ['game/src/encounter.ts'] });
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText('Used by game/src/encounter.ts')).not.toBeNull();
  });

  it('deletes an unreferenced species as a draft', async () => {
    api.listSpecies.mockResolvedValue(library());
    api.putSpeciesDraft.mockResolvedValue({
      speciesId: species.id,
      state: 'deleted',
      data: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    render(<Workshop />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(api.putSpeciesDraft).toHaveBeenCalledWith({
        speciesId: 'testling',
        state: 'deleted',
        data: null,
      }),
    );
  });
});
