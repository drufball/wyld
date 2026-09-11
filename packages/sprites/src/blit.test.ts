/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blitSprite, clearSpriteCache } from './blit-canvas.js';
import { paintSprite, type PaintRect } from './blit.js';
import { generateSprite } from './index.js';
import type { SpeciesData } from './species.js';
import type { PixelSprite, SpriteFacing, SpriteFrame } from './types.js';

type SoftwareContext = {
  fillStyle: string;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  clearRect: (x: number, y: number, width: number, height: number) => void;
  drawImage: (source: FakeCanvas, x: number, y: number) => void;
};
type FakeCanvas = {
  width: number;
  height: number;
  readonly buffer: Uint8ClampedArray;
  getContext: (kind: string) => SoftwareContext | null;
};

const parseColour = (colour: string): [number, number, number] | undefined => {
  if (colour === 'transparent') return undefined;
  const hex = colour.slice(1);
  const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
  return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
};

const fakeCanvas = (): FakeCanvas => {
  let width = 0;
  let height = 0;
  let buffer = new Uint8ClampedArray();
  const allocate = () => {
    buffer = new Uint8ClampedArray(width * height * 4);
  };
  const context: SoftwareContext = {
    fillStyle: '#000',
    fillRect(x, y, rectWidth, rectHeight) {
      const colour = parseColour(this.fillStyle);
      if (!colour) return;
      for (let py = y; py < y + rectHeight; py++)
        for (let px = x; px < x + rectWidth; px++) {
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const offset = (py * width + px) * 4;
          buffer.set([...colour, 255], offset);
        }
    },
    clearRect(x, y, rectWidth, rectHeight) {
      for (let py = y; py < y + rectHeight; py++)
        for (let px = x; px < x + rectWidth; px++) {
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          buffer.fill(0, (py * width + px) * 4, (py * width + px + 1) * 4);
        }
    },
    drawImage(source, x, y) {
      for (let py = 0; py < source.height; py++)
        for (let px = 0; px < source.width; px++) {
          const sourceOffset = (py * source.width + px) * 4;
          if (source.buffer[sourceOffset + 3] === 0) continue;
          const targetX = x + px;
          const targetY = y + py;
          if (targetX < 0 || targetY < 0 || targetX >= width || targetY >= height) continue;
          buffer.set(
            source.buffer.subarray(sourceOffset, sourceOffset + 4),
            (targetY * width + targetX) * 4,
          );
        }
    },
  };
  const canvas = {
    get buffer() {
      return buffer;
    },
    getContext: (kind: string) => (kind === '2d' ? context : null),
  } as FakeCanvas;
  Object.defineProperties(canvas, {
    width: {
      get: () => width,
      set: (value: number) => {
        width = value;
        allocate();
      },
    },
    height: {
      get: () => height,
      set: (value: number) => {
        height = value;
        allocate();
      },
    },
  });
  return canvas;
};

const contextOf = (canvas: FakeCanvas): CanvasRenderingContext2D =>
  canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
const canvasWithSize = (width: number, height: number): FakeCanvas => {
  const canvas = fakeCanvas();
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const oldBlitCache = new Map<string, HTMLCanvasElement>();
const oldBlit = (
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite & { key: string },
  x: number,
  y: number,
  flipX = false,
): number => {
  const key = `${sprite.key}:${flipX}`;
  let canvas = oldBlitCache.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const target = canvas.getContext('2d')!;
    for (let py = 0; py < sprite.height; py++)
      for (let px = 0; px < sprite.width; px++) {
        const index = sprite.grid[py * sprite.width + px] ?? 0;
        if (!index) continue;
        target.fillStyle = sprite.palette[index] ?? '#000';
        target.fillRect(flipX ? sprite.width - 1 - px : px, py, 1, 1);
      }
    oldBlitCache.set(key, canvas);
  }
  ctx.drawImage(canvas, x, y);
  return 1;
};

const oldCreatureCache = new Map<string, HTMLCanvasElement>();
const oldCreatureLoop = (
  ctx: CanvasRenderingContext2D,
  data: SpeciesData,
  facing: SpriteFacing,
  frame: SpriteFrame,
  x: number,
  y: number,
  flip = false,
): number => {
  const key = `${data.id}:${facing}:${frame}:${flip}`;
  let canvas = oldCreatureCache.get(key);
  if (!canvas) {
    const sprite = generateSprite(data, facing, frame);
    canvas = document.createElement('canvas');
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const target = canvas.getContext('2d')!;
    for (let py = 0; py < sprite.height; py++)
      for (let px = 0; px < sprite.width; px++) {
        const index = sprite.grid[py * sprite.width + px]!;
        if (index) {
          target.fillStyle = sprite.palette[index]!;
          target.fillRect(flip ? sprite.width - 1 - px : px, py, 1, 1);
        }
      }
    oldCreatureCache.set(key, canvas);
  }
  ctx.drawImage(canvas, x, y);
  return 1;
};

const oldPakBlit = (canvas: FakeCanvas, sprite: PixelSprite, scale: number): void => {
  canvas.width = sprite.width * scale;
  canvas.height = sprite.height * scale;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  sprite.grid.forEach((index, position) => {
    if (index !== 0) {
      context.fillStyle = sprite.palette[index]!;
      context.fillRect(
        (position % sprite.width) * scale,
        Math.floor(position / sprite.width) * scale,
        scale,
        scale,
      );
    }
  });
};

const species = JSON.parse(
  readFileSync(new URL('../../../game/src/data/species.json', import.meta.url), 'utf8'),
) as SpeciesData[];
const facings: SpriteFacing[] = ['down', 'up', 'side'];
const frames: SpriteFrame[] = ['idle', 'walk0', 'walk1', 'execute'];

expect.addEqualityTesters([
  (left, right) => {
    if (!(left instanceof Uint8ClampedArray) || !(right instanceof Uint8ClampedArray))
      return undefined;
    return left.length === right.length && left.every((value, index) => value === right[index]);
  },
]);

afterEach(() => {
  clearSpriteCache();
  oldBlitCache.clear();
  oldCreatureCache.clear();
  vi.unstubAllGlobals();
});

describe('sprite blitting', () => {
  it('draws every species pixel-identically to the three old drawers', () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    for (const data of species)
      for (const facing of facings)
        for (const frame of frames)
          for (const flip of [false, true]) {
            const sprite = generateSprite(data, facing, frame);
            const width = sprite.width + 6;
            const height = sprite.height + 10;
            const oldPlayerTarget = canvasWithSize(width, height);
            const newPlayerTarget = canvasWithSize(width, height);
            oldBlit(
              contextOf(oldPlayerTarget),
              { ...sprite, key: `${data.id}:${facing}:${frame}` },
              3,
              5,
              flip,
            );
            blitSprite(contextOf(newPlayerTarget), sprite, sprite.palette, {
              x: 3,
              y: 5,
              flip,
              cache: `player:${data.id}:${facing}:${frame}`,
            });
            expect(newPlayerTarget.buffer).toEqual(oldPlayerTarget.buffer);

            const oldCreatureTarget = canvasWithSize(width, height);
            const newCreatureTarget = canvasWithSize(width, height);
            oldCreatureLoop(contextOf(oldCreatureTarget), data, facing, frame, 3, 5, flip);
            blitSprite(contextOf(newCreatureTarget), sprite, sprite.palette, {
              x: 3,
              y: 5,
              flip,
              cache: `creature:${data.id}:${facing}:${frame}`,
            });
            expect(newCreatureTarget.buffer).toEqual(oldCreatureTarget.buffer);

            const oldPakTarget = fakeCanvas();
            const newPakTarget = fakeCanvas();
            oldPakBlit(oldPakTarget, sprite, 4);
            newPakTarget.width = sprite.width * 4;
            newPakTarget.height = sprite.height * 4;
            const newPakContext = contextOf(newPakTarget);
            newPakContext.clearRect(0, 0, newPakTarget.width, newPakTarget.height);
            blitSprite(newPakContext, sprite, sprite.palette, { x: 0, y: 0, scale: 4 });
            expect(newPakTarget.buffer).toEqual(oldPakTarget.buffer);
          }
  });

  it('skips palette index 0 and flips around the sprite width', () => {
    const sprite: PixelSprite = {
      width: 3,
      height: 2,
      palette: ['transparent', '#123', '#abcdef'],
      grid: Uint8Array.from([1, 0, 2, 0, 2, 0]),
    };
    const calls: Parameters<PaintRect>[] = [];
    paintSprite(sprite, sprite.palette, 2, false, (...args) => calls.push(args));
    expect(calls).toEqual([
      [0, 0, 2, 2, '#123'],
      [4, 0, 2, 2, '#abcdef'],
      [2, 2, 2, 2, '#abcdef'],
    ]);
    calls.length = 0;
    paintSprite(sprite, sprite.palette, 2, true, (...args) => calls.push(args));
    expect(calls).toEqual([
      [4, 0, 2, 2, '#123'],
      [0, 0, 2, 2, '#abcdef'],
      [2, 2, 2, 2, '#abcdef'],
    ]);
  });

  it('reuses one offscreen canvas per cache key, flip and scale', () => {
    const createElement = vi.fn(() => fakeCanvas());
    vi.stubGlobal('document', { createElement });
    const target = canvasWithSize(20, 20);
    const context = target.getContext('2d')!;
    const drawImage = vi.spyOn(context, 'drawImage');
    const sprite: PixelSprite = {
      width: 1,
      height: 1,
      palette: ['transparent', '#fff'],
      grid: Uint8Array.of(1),
    };
    const options = { x: 0, y: 0, cache: 'same', scale: 2 };
    blitSprite(contextOf(target), sprite, sprite.palette, options);
    blitSprite(contextOf(target), sprite, sprite.palette, options);
    expect(createElement).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledTimes(2);
    blitSprite(contextOf(target), sprite, sprite.palette, { ...options, flip: true });
    expect(createElement).toHaveBeenCalledTimes(2);
    clearSpriteCache();
    blitSprite(contextOf(target), sprite, sprite.palette, options);
    expect(createElement).toHaveBeenCalledTimes(3);
  });

  it('paints straight onto the target when there is no cache', () => {
    expect(globalThis.document).toBeUndefined();
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const sprite: PixelSprite = {
      width: 2,
      height: 1,
      palette: ['transparent', '#abc'],
      grid: Uint8Array.from([0, 1]),
    };
    blitSprite(context as unknown as CanvasRenderingContext2D, sprite, sprite.palette, {
      x: 4,
      y: 5,
      scale: 3,
    });
    expect(context.fillRect).toHaveBeenCalledWith(7, 5, 3, 3);
    expect(context.fillStyle).toBe('#abc');
    expect(context.drawImage).not.toHaveBeenCalled();
  });
});
