import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from './textarea.js';
describe('Textarea', () => {
  it('keeps a 44px target', () => {
    render(<Textarea aria-label="Notes" />);
    expect(screen.getByLabelText('Notes').className).toContain('min-h-11');
  });
});
