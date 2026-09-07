import type { BodyPlanId } from './species.js';

type SpriteSpec = {
  bodyPlan: BodyPlanId;
  tier: 1 | 2 | 3;
  palette: { primary: string; secondary: string; accent?: string };
  visual: Record<string, number>;
};
type SpriteFacing = 'down' | 'up' | 'side';
type SpriteFrame = 'idle' | 'walk0' | 'walk1' | 'execute';
type PixelSprite = { width: number; height: number; palette: readonly string[]; grid: Uint8Array };
type Painter = (spec: SpriteSpec, facing: SpriteFacing, frame: SpriteFrame) => PixelSprite;

export type { Painter, PixelSprite, SpriteFacing, SpriteFrame, SpriteSpec };
