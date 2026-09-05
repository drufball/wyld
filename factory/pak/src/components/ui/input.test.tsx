import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input.js';
describe('Input', () => {
  it('keeps a 44px target', () => {
    render(<Input aria-label="Name" />);
    expect(screen.getByLabelText('Name').className).toContain('min-h-11');
  });
});
