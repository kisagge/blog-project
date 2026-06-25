// 아이템 테이블 + 시드 기반 생성(보물·상점). 순수.
import { randInt, weightedPick, type Roll } from "./rng";
import type { Item } from "./types";

export const WEAPONS: readonly Item[] = [
  { id: "w1", name: "녹슨 단검", kind: "weapon", power: 3, price: 15 },
  { id: "w2", name: "강철 검", kind: "weapon", power: 6, price: 35 },
  { id: "w3", name: "대검", kind: "weapon", power: 10, price: 70 },
  { id: "w4", name: "룬 블레이드", kind: "weapon", power: 15, price: 120 },
];
export const ARMORS: readonly Item[] = [
  { id: "a1", name: "가죽 갑옷", kind: "armor", power: 2, price: 15 },
  { id: "a2", name: "사슬 갑옷", kind: "armor", power: 4, price: 35 },
  { id: "a3", name: "판금 갑옷", kind: "armor", power: 7, price: 70 },
  { id: "a4", name: "룬 갑옷", kind: "armor", power: 11, price: 120 },
];
export const POTION: Item = {
  id: "p1",
  name: "체력 물약",
  kind: "potion",
  power: 15,
  price: 12,
};

// 깊이에 맞는 티어(0..3) — 깊을수록 상위 확률↑.
function tier(seed: number, depth: number): Roll<number> {
  const base = Math.min(3, Math.floor((depth - 1) / 2));
  return randInt(seed, Math.max(0, base - 1), Math.min(3, base + 1));
}
const idx = (arr: readonly Item[], i: number) =>
  arr[Math.min(arr.length - 1, i)];

// 보물용 무작위 아이템(무기/방어구/물약).
export function randomItem(seed: number, depth: number): Roll<Item> {
  const k = weightedPick(seed, [
    { item: "weapon" as const, weight: 35 },
    { item: "armor" as const, weight: 35 },
    { item: "potion" as const, weight: 30 },
  ]);
  if (k.value === "potion") return { value: POTION, seed: k.seed };
  const table = k.value === "weapon" ? WEAPONS : ARMORS;
  const t = tier(k.seed, depth);
  return { value: idx(table, t.value), seed: t.seed };
}

// 상점 재고: 무기·방어구·물약 각 1.
export function shopStock(seed: number, depth: number): Roll<Item[]> {
  const tw = tier(seed, depth);
  const ta = tier(tw.seed, depth);
  return {
    value: [idx(WEAPONS, tw.value), idx(ARMORS, ta.value), POTION],
    seed: ta.seed,
  };
}
