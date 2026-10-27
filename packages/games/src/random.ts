/** Source of randomness, injected into every engine so tests replay the same game. Returns a float in [0, 1). */
export interface Random {
  next(): number;
}

/** Mulberry32: small, fast and good enough to shuffle cards. Not for anything secret. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export const mathRandom: Random = { next: () => Math.random() };

/** Integer in [min, max], both included. */
export function randomInt(rng: Random, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

export function pickOne<T>(rng: Random, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pickOne needs at least one item");
  return items[Math.floor(rng.next() * items.length)] as T;
}

/** Fisher-Yates on a copy. */
export function shuffle<T>(rng: Random, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** `count` distinct indices in [0, size), drawn without replacement. */
export function distinctIndices(rng: Random, size: number, count: number): number[] {
  if (count > size) throw new Error(`cannot draw ${count} distinct indices out of ${size}`);
  return shuffle(
    rng,
    Array.from({ length: size }, (_, i) => i),
  ).slice(0, count);
}
