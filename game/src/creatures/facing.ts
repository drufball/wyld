import type { SpriteFacing } from '@wyld/sprites';
import type { Facing } from '../player/controller.js';

/**
 * Facing is a Three.js yaw in radians: 0 is world +z (screen-down), increasing
 * toward world +x (screen-right), and movement uses Math.atan2(dx, dz). Body
 * plans point their heads toward local +z.
 */
const FACING_YAW: Record<Facing, number> = {
  down: 0,
  up: Math.PI,
  right: Math.PI / 2,
  left: -Math.PI / 2,
};

const yawFromDelta = (dx: number, dz: number): number => Math.atan2(dx, dz);

const spriteFacingFromCardinal = (facing: Facing): { facing: SpriteFacing; flip: boolean } =>
  facing === 'left' || facing === 'right'
    ? { facing: 'side', flip: facing === 'left' }
    : { facing, flip: false };

const spriteFacingFromYaw = (yaw: number): { facing: SpriteFacing; flip: boolean } => {
  const side = Math.abs(Math.sin(yaw)) > 0.5;
  return {
    facing: side ? 'side' : Math.cos(yaw) < 0 ? 'up' : 'down',
    flip: side && Math.sin(yaw) < 0,
  };
};

export { FACING_YAW, spriteFacingFromCardinal, spriteFacingFromYaw, yawFromDelta };
