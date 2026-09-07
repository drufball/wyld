import { useEffect, useMemo, useRef } from 'react';
import {
  generateSprite,
  type SpriteFacing,
  type SpriteFrame,
  type SpriteSpec,
} from '@wyld/sprites';
import { blitSprite } from '../lib/sprite-canvas.js';
export function SpriteCanvas({
  spec,
  facing,
  frame,
  scale,
  label,
  className,
}: {
  spec: SpriteSpec;
  facing: SpriteFacing;
  frame: SpriteFrame;
  scale: number;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sprite = useMemo(() => generateSprite(spec, facing, frame), [spec, facing, frame]);
  useEffect(() => {
    if (ref.current) blitSprite(ref.current, sprite, scale);
  }, [sprite, scale]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className={`[image-rendering:pixelated] ${className ?? ''}`}
    />
  );
}
