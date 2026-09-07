type Rng = {
  next(): number;
  int(maxExclusive: number): number;
  range(min: number, max: number): number;
  seed(): number;
};

const createRng = (seed: number): Rng => {
  const initialSeed = seed >>> 0;
  let value = initialSeed;
  const next = (): number => {
    value = (value + 0x6d2b79f5) >>> 0;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(maxExclusive): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError('maxExclusive must be a positive integer');
      }
      return Math.floor(next() * maxExclusive);
    },
    range(min, max): number {
      if (max < min) throw new RangeError('max must be greater than or equal to min');
      return min + next() * (max - min);
    },
    seed: () => initialSeed,
  };
};

const resolveSeed = (): number => {
  const value = new URLSearchParams(window.location.search).get('seed');
  if (value !== null && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed >>> 0;
  }
  const generated = new Uint32Array(1);
  crypto.getRandomValues(generated);
  return generated[0] ?? 0;
};

export { createRng, resolveSeed };
export type { Rng };
