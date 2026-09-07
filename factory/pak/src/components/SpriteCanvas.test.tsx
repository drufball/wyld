import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SpriteSpec } from '@wyld/sprites';

const { blitSprite } = vi.hoisted(() => ({ blitSprite: vi.fn() }));
vi.mock('../lib/sprite-canvas.js', () => ({ blitSprite }));

import { SpriteCanvas } from './SpriteCanvas.js';

describe('SpriteCanvas', () => {
  it('blits the generated sprite for the given species, facing and frame', async () => {
    const spec: SpriteSpec = {
      bodyPlan: 'avian',
      tier: 2,
      palette: { primary: '#123456', secondary: '#abcdef', accent: '#fedcba' },
      visual: { wings: 1 },
    };
    render(<SpriteCanvas spec={spec} facing="side" frame="walk1" scale={4} label="Test sprite" />);
    await waitFor(() => expect(blitSprite).toHaveBeenCalled());
    const sprite = blitSprite.mock.calls[0]![1];
    expect(sprite).toMatchObject({ width: 24, height: 24 });
    expect(sprite.palette).toEqual([
      'transparent',
      spec.palette.primary,
      spec.palette.secondary,
      spec.palette.accent,
    ]);
  });
});
