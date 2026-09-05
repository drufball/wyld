import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge.js';
describe('Badge', () => {
  it('applies tone variant', () => {
    render(
      <Badge variant="tone" data-tone="bad">
        Bad
      </Badge>,
    );
    expect(screen.getByText('Bad').className).toContain('data-[tone=bad]:text-dracula-red');
  });
});
