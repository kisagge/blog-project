// 시드 결정론 PRNG(mulberry32). 모든 함수는 순수 — seed를 받아 값 + 다음 seed를 반환.
// state.seed를 전진시켜 같은 시드 → 같은 런(테스트·재현·시드 공유).

export type Roll<T> = { value: T; seed: number };

// [0,1) 난수 + 다음 seed.
export function rng(seed: number): Roll<number> {
  const a = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: a };
}

// lo..hi(양끝 포함) 정수.
export function randInt(seed: number, lo: number, hi: number): Roll<number> {
  const r = rng(seed);
  return { value: lo + Math.floor(r.value * (hi - lo + 1)), seed: r.seed };
}

// 확률 p로 true.
export function chance(seed: number, p: number): Roll<boolean> {
  const r = rng(seed);
  return { value: r.value < p, seed: r.seed };
}

// 배열에서 균등 선택.
export function pick<T>(seed: number, arr: readonly T[]): Roll<T> {
  const r = randInt(seed, 0, arr.length - 1);
  return { value: arr[r.value], seed: r.seed };
}

// 가중 선택. entries=[{item, weight>0}].
export function weightedPick<T>(
  seed: number,
  entries: readonly { item: T; weight: number }[],
): Roll<T> {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  const r = rng(seed);
  let x = r.value * total;
  for (const e of entries) {
    x -= e.weight;
    if (x < 0) return { value: e.item, seed: r.seed };
  }
  return { value: entries[entries.length - 1].item, seed: r.seed };
}

// 문자열 시드 → uint32(시드 공유용). FNV-1a.
export function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
