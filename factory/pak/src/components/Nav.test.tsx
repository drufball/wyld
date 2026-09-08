import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Nav } from './Nav.js';

describe('Nav', () => {
  it('lists seven destinations without demos', () => {
    render(
      <MemoryRouter>
        <Nav />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/quests',
      '/roadmap',
      '/workshop',
      '/rumble',
      '/debug',
      '/memory',
    ]);
    for (const link of links) {
      expect(link.querySelectorAll('.pak-nav__label--mobile')).toHaveLength(1);
      expect(link.querySelectorAll('.pak-nav__label--desktop')).toHaveLength(1);
    }
    const roadmap = screen.getByRole('link', { name: 'Roadmap' });
    expect(roadmap.querySelector('.pak-nav__label--mobile')?.textContent).toBe('MAP');
    expect(roadmap.querySelector('.pak-nav__label--desktop')?.textContent).toBe('ROADMAP');
  });
});
