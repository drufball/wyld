import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Concepts } from './Concepts.js';

const response = (value: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(value) } as Response);
const concept = {
  slug: 'creature-dynamics',
  questId: null,
  kind: 'concept',
  title: 'Creature dynamics',
  summary: 'How creatures move.',
  version: 1,
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
} as const;

afterEach(() => vi.unstubAllGlobals());
describe('Concepts', () => {
  it('lists only concept explainers and links to each one', async () => {
    const fetch = vi.fn(() => response([concept]));
    vi.stubGlobal('fetch', fetch);
    render(
      <MemoryRouter>
        <Concepts />
      </MemoryRouter>,
    );
    expect(
      (await screen.findByRole('link', { name: /Creature dynamics/ })).getAttribute('href'),
    ).toBe('/explain/creature-dynamics');
    expect(fetch).toHaveBeenCalledWith('/api/artifacts?kind=concept', expect.anything());
  });
  it('says when there are no concept explainers yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([])),
    );
    render(
      <MemoryRouter>
        <Concepts />
      </MemoryRouter>,
    );
    expect(await screen.findByText('No concept explainers yet.')).not.toBeNull();
  });
});
