import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { resetFeedback } from '../lib/feedback.js';
import { SfxToggle } from './SfxToggle.js';

afterEach(() => {
  resetFeedback();
  localStorage.clear();
});

it('shows, flips, and persists the sound setting', () => {
  localStorage.setItem('wyld.sfx', 'off');
  render(<SfxToggle />);
  const toggle = screen.getByRole('button', { name: 'Sounds & rumble: off' });
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(toggle);
  expect(
    screen.getByRole('button', { name: 'Sounds & rumble: on' }).getAttribute('aria-pressed'),
  ).toBe('true');
  expect(localStorage.getItem('wyld.sfx')).toBe('on');
});
