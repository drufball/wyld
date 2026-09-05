import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './card.js';
describe('Card', () => {
  it('passes tone through', () => {
    render(<Card variant="bevel" data-tone="ok" aria-label="status" />);
    expect(screen.getByLabelText('status').getAttribute('data-tone')).toBe('ok');
  });
});
