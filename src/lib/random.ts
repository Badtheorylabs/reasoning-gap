export function createRNG(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s |= 0;
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function randomProbs(rng: () => number, n: number): number[] {
  const raw = Array.from({ length: n }, () => 0.1 + rng() * 0.8);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / sum);
}
