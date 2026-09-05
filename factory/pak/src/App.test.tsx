import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App.js';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const placeholders = [
  ['Worlds', 'Every world, and the quests inside it.'],
  ['Demos', 'Demo Discs — builds you can try right now.'],
  ['Rumble', 'Decisions only you can make.'],
  ['Debug', 'Factory health, architecture, and the raw event stream.'],
  ['Memory', 'Save files — retros, stats, achievements.'],
] as const;

describe('Pak shell', () => {
  it('renders Today and all six tab destinations at the root', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { name: 'Today' })).not.toBeNull();
    for (const label of ['Today', 'Worlds', 'Demos', 'Rumble', 'Debug', 'Memory']) {
      expect(screen.getByRole('link', { name: label })).not.toBeNull();
    }
  });

  it.each(placeholders)('navigates to %s and renders its purpose', (name, purpose) => {
    renderAt('/');

    fireEvent.click(screen.getByRole('link', { name }));

    expect(screen.getByRole('heading', { name })).not.toBeNull();
    expect(screen.getByText(purpose)).not.toBeNull();
  });

  it('renders the VMU without shell navigation', () => {
    renderAt('/vmu');

    expect(screen.getByRole('heading', { name: 'VMU' })).not.toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('redirects unknown paths to Today', async () => {
    renderAt('/lost-save');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Today' })).not.toBeNull());
  });
});
