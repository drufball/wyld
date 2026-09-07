import type { TracksDescriptor } from '../creatures/species.js';

type DecalRect = { x: number; y: number; w: number; h: number };

const trackDecalRects = (descriptor: TracksDescriptor): readonly DecalRect[] => {
  if (descriptor.kind === 'feather')
    return [
      { x: 0, y: -5, w: 1, h: 11 },
      { x: -5, y: -1, w: 11, h: 1 },
      { x: -4, y: 2, w: 4, h: 1 },
      { x: 1, y: -4, w: 4, h: 1 },
    ];
  if (descriptor.kind === 'shard')
    return [
      { x: -1, y: -5, w: 2, h: 11 },
      { x: -4, y: -1, w: 9, h: 3 },
    ];
  if (descriptor.kind === 'furrow')
    return [
      { x: -5, y: -3, w: 11, h: 2 },
      { x: -5, y: 2, w: 11, h: 2 },
    ];
  if (descriptor.kind === 'coil')
    return [
      { x: -4, y: -5, w: 9, h: 2 },
      { x: -5, y: -3, w: 2, h: 3 },
      { x: -4, y: -1, w: 9, h: 2 },
      { x: 4, y: 1, w: 2, h: 3 },
      { x: -4, y: 4, w: 9, h: 2 },
    ];

  const toes = descriptor.toes ?? 2;
  const toeW = toes >= 5 ? 1 : 2;
  const toeRects: DecalRect[] =
    toes === 1
      ? [{ x: -1, y: -6, w: 2, h: 3 }]
      : Array.from({ length: toes }, (_, i) => ({
          x: -5 + Math.round((i * (10 - toeW)) / Math.max(1, toes - 1)),
          y: -6,
          w: toeW,
          h: 3,
        }));
  return [
    ...toeRects,
    { x: -4, y: 0, w: 4, h: 2 },
    { x: 1, y: 3, w: 4, h: 2 },
    ...(descriptor.drag ? [{ x: 0, y: -2, w: 1, h: 7 }] : []),
  ];
};

export { trackDecalRects };
export type { DecalRect };
