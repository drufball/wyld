import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button.js';
describe('Button', () => {
  it('supports variants and asChild', () => {
    render(
      <Button asChild variant="retro">
        <a href="/next">Next</a>
      </Button>,
    );
    expect(screen.getByRole('link').className).toContain('font-display');
  });
});
