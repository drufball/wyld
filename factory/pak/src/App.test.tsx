import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
  ['Debug', 'Factory health, architecture, and the raw event stream.'],
  ['Memory', 'Save files — retros, stats, achievements.'],
] as const;

describe('Pak shell', () => {
  it('renders Today and all six tab destinations at the root', async () => {
    renderAt('/');

    expect(await screen.findByText('What do we make today?')).not.toBeNull();
    for (const label of ['Today', 'Worlds', 'Demos', 'Rumble', 'Debug', 'Memory']) {
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
      'WORLD',
      'DEMOS',
      'RMBL',
      'DEBUG',
      'MEM',
    ]);
    expect(desktopLabels.map(({ textContent }) => textContent)).toEqual([
      'TODAY',
      'WORLDS',
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

  it('navigates to the Worlds hub', async () => {
    renderAt('/');
    await screen.findByText('What do we make today?');
    fireEvent.click(screen.getByRole('link', { name: 'Worlds' }));
    expect(screen.getByRole('heading', { name: 'Worlds' })).not.toBeNull();
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
