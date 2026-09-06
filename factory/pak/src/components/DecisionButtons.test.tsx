import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { vibrate } from '../lib/feedback.js';
import { DecisionButtons } from './DecisionButtons.js';

vi.mock('../lib/feedback.js', () => ({ vibrate: vi.fn() }));

it('vibrates and decides when an option is clicked', () => {
  const decide = vi.fn();
  render(
    <DecisionButtons
      id="pick-path"
      options={['Forest', 'River']}
      deciding={false}
      failed={null}
      decide={decide}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Forest' }));

  expect(vibrate).toHaveBeenCalledWith([30, 40, 60]);
  expect(decide).toHaveBeenCalledWith('pick-path', 'Forest');
});
