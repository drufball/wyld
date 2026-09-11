import { useEffect, useMemo, useRef } from 'react';
import {
  blitSprite,
  generateSprite,
  type SpriteFacing,
  type SpriteFrame,
  type SpriteSpec,
} from '@wyld/sprites';
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
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = sprite.width * scale;
    canvas.height = sprite.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    blitSprite(ctx, sprite, sprite.palette, { x: 0, y: 0, scale });
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
