// 아이템 테이블 + 시드 기반 생성(보물·상점). 순수.
import { chance, randInt, weightedPick, type Roll } from "./rng";
import type { Item } from "./types";

export const WEAPONS: readonly Item[] = [
  { id: "w1", name: "녹슨 단검", kind: "weapon", power: 3, price: 15 },
  { id: "w2", name: "강철 검", kind: "weapon", power: 6, price: 35 },
  { id: "w3", name: "대검", kind: "weapon", power: 10, price: 70 },
  { id: "w4", name: "룬 블레이드", kind: "weapon", power: 15, price: 120 },
  { id: "w5", name: "심연검", kind: "weapon", power: 21, price: 200 },
];
export const ARMORS: readonly Item[] = [
  { id: "a1", name: "가죽 갑옷", kind: "armor", power: 2, price: 15 },
  { id: "a2", name: "사슬 갑옷", kind: "armor", power: 4, price: 35 },
  { id: "a3", name: "판금 갑옷", kind: "armor", power: 7, price: 70 },
  { id: "a4", name: "룬 갑옷", kind: "armor", power: 11, price: 120 },
  { id: "a5", name: "심연 갑주", kind: "armor", power: 16, price: 200 },
];
export const POTION: Item = {
  id: "p1",
  name: "체력 물약",
  kind: "potion",
  power: 15,
  price: 12,
};
export const GREATER_POTION: Item = {
  id: "p2",
  name: "큰 체력 물약",
  kind: "potion",
  power: 32,
  price: 28,
};

const TOP_TIER = WEAPONS.length - 1; // = ARMORS.length-1
// 깊은 층(≥4)부터 큰 물약이 등장.
const GREATER_DEPTH = 4;

// 깊이에 맞는 티어(0..TOP_TIER) — 깊을수록 상위 확률↑.
function tier(seed: number, depth: number): Roll<number> {
  const base = Math.min(TOP_TIER, Math.floor((depth - 1) / 2));
  return randInt(seed, Math.max(0, base - 1), Math.min(TOP_TIER, base + 1));
}
const idx = (arr: readonly Item[], i: number) =>
  arr[Math.min(arr.length - 1, i)];

// 깊이별 물약(깊으면 큰 물약 확률). 결정론.
function potionFor(seed: number, depth: number): Roll<Item> {
  if (depth < GREATER_DEPTH) return { value: POTION, seed };
  const c = chance(seed, 0.4);
  return { value: c.value ? GREATER_POTION : POTION, seed: c.seed };
}

// 보물용 무작위 아이템(무기/방어구/물약).
export function randomItem(seed: number, depth: number): Roll<Item> {
  const k = weightedPick(seed, [
    { item: "weapon" as const, weight: 35 },
    { item: "armor" as const, weight: 35 },
    { item: "potion" as const, weight: 30 },
  ]);
  if (k.value === "potion") return potionFor(k.seed, depth);
  const table = k.value === "weapon" ? WEAPONS : ARMORS;
  const t = tier(k.seed, depth);
  return { value: idx(table, t.value), seed: t.seed };
}

// 상점 재고: 무기·방어구·물약 각 1.
export function shopStock(seed: number, depth: number): Roll<Item[]> {
  const tw = tier(seed, depth);
  const ta = tier(tw.seed, depth);
  const p = potionFor(ta.seed, depth);
  return {
    value: [idx(WEAPONS, tw.value), idx(ARMORS, ta.value), p.value],
    seed: p.seed,
  };
}
