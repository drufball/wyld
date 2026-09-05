import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Panel } from './Panel.js';

describe('Panel', () => {
  it('renders its children', () => {
    render(<Panel>Memory card inserted</Panel>);

    expect(screen.getByText('Memory card inserted')).not.toBeNull();
  });
});
