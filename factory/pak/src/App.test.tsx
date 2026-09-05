import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App.js';

const inertEventSource = () => ({ addEventListener() {}, removeEventListener() {}, close() {} });

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App eventSourceFactory={inertEventSource} />
    </MemoryRouter>,
  );
}

const placeholders = [
  ['Demos', 'Demo Discs — builds you can try right now.'],
  ['Rumble', 'Decisions only you can make.'],
  ['Memory', 'Save files — retros, stats, achievements.'],
] as const;

describe('Pak shell', () => {
  it.each([
    ['/worlds', 'All'],
    ['/worlds/wyld', 'WYLD'],
  ])('redirects %s to the Quests screen', async (path, selectedWorld) => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              url === '/api/worlds'
                ? [
                    {
                      id: 'wyld',
                      name: 'WYLD',
                      kind: 'game',
                      order: 0,
                      icon: 'tree',
                      questCounts: {
                        idea: 0,
                        planning: 0,
                        building: 0,
                        demo: 0,
                        done: 0,
                        parked: 0,
                      },
                    },
                  ]
                : [],
            ),
        } as Response),
      ),
    );
    renderAt(path);

    expect(await screen.findByRole('heading', { name: 'Quests' })).not.toBeNull();
    if (selectedWorld === 'WYLD') {
      expect(
        (await screen.findByRole('button', { name: 'WYLD' })).getAttribute('aria-pressed'),
      ).toBe('true');
    }
    vi.unstubAllGlobals();
  });

  it('renders Today and all six tab destinations at the root', async () => {
    renderAt('/');

    expect(await screen.findByText('What do we make today?')).not.toBeNull();
    for (const label of ['Today', 'Quests', 'Demos', 'Rumble', 'Debug', 'Memory']) {
      expect(screen.getByRole('link', { name: label })).not.toBeNull();
    }
  });

  it('renders compact and full label sets for responsive navigation', () => {
    const { container } = renderAt('/');
    const mobileLabels = Array.from(
      container.querySelectorAll<HTMLElement>('.pak-nav__label--mobile'),
    );
    const desktopLabels = Array.from(
      container.querySelectorAll<HTMLElement>('.pak-nav__label--desktop'),
    );

    expect(mobileLabels.map(({ textContent }) => textContent)).toEqual([
      'TODAY',
      'QUEST',
      'DEMOS',
      'RMBL',
      'DEBUG',
      'MEM',
    ]);
    expect(desktopLabels.map(({ textContent }) => textContent)).toEqual([
      'TODAY',
      'QUESTS',
      'DEMOS',
      'RUMBLE',
      'DEBUG',
      'MEMORY',
    ]);
  });

  it.each(placeholders)('navigates to %s and renders its purpose', async (name, purpose) => {
    renderAt('/');

    await screen.findByText('What do we make today?');

    fireEvent.click(screen.getByRole('link', { name }));

    expect(screen.getByRole('heading', { name })).not.toBeNull();
    expect(screen.getByText(purpose)).not.toBeNull();
  });

  it('navigates to Quests', async () => {
    renderAt('/');
    await screen.findByText('What do we make today?');
    fireEvent.click(screen.getByRole('link', { name: 'Quests' }));
    expect(screen.getByRole('heading', { name: 'Quests' })).not.toBeNull();
  });

  it('navigates to the Debug Menu', async () => {
    renderAt('/');
    await screen.findByText('What do we make today?');
    fireEvent.click(screen.getByRole('link', { name: 'Debug' }));
    expect(screen.getByRole('heading', { name: 'Debug Menu' })).not.toBeNull();
    expect(screen.getByText('Reading the factory…')).not.toBeNull();
  });

  it('renders the VMU without shell navigation', () => {
    renderAt('/vmu');

    expect(screen.getByRole('heading', { name: 'VMU' })).not.toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('redirects unknown paths to Today', async () => {
    renderAt('/lost-save');

    await waitFor(() => expect(screen.getByText('What do we make today?')).not.toBeNull());
  });
});
