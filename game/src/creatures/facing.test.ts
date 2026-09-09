import { describe, expect, it } from 'vitest';
import {
  FACING_YAW,
  spriteFacingFromCardinal,
  spriteFacingFromYaw,
  yawFromDelta,
} from './facing.js';

const forwardAfterYaw = (yaw: number): { x: number; z: number } => ({
  x: Math.sin(yaw),
  z: Math.cos(yaw),
});
const angleDifference = (a: number, b: number): number =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));

describe('facing convention', () => {
  it('faces a creature walking right toward +x', () => {
    const forward = forwardAfterYaw(FACING_YAW.right);
    expect(forward.x).toBeCloseTo(1);
    expect(forward.z).toBeCloseTo(0);
  });

  it('faces a creature walking left toward -x', () => {
    const forward = forwardAfterYaw(FACING_YAW.left);
    expect(forward.x).toBeCloseTo(-1);
    expect(forward.z).toBeCloseTo(0);
  });

  it('agrees with yawFromDelta for all four cardinals', () => {
    expect(angleDifference(FACING_YAW.right, yawFromDelta(1, 0))).toBeCloseTo(0);
    expect(angleDifference(FACING_YAW.left, yawFromDelta(-1, 0))).toBeCloseTo(0);
    expect(angleDifference(FACING_YAW.down, yawFromDelta(0, 1))).toBeCloseTo(0);
    expect(angleDifference(FACING_YAW.up, yawFromDelta(0, -1))).toBeCloseTo(0);
  });

  it('draws a creature walking right as an unflipped side sprite', () => {
    const expected = { facing: 'side', flip: false };
    expect(spriteFacingFromCardinal('right')).toEqual(expected);
    expect(spriteFacingFromYaw(FACING_YAW.right)).toEqual(expected);
  });

  it('flips the side sprite only when facing left', () => {
    for (const facing of ['left', 'right', 'up', 'down'] as const) {
      const expectedFlip = facing === 'left';
      expect(spriteFacingFromCardinal(facing).flip).toBe(expectedFlip);
      expect(spriteFacingFromYaw(FACING_YAW[facing]).flip).toBe(expectedFlip);
    }
  });
});
