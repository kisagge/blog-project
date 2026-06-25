// 걸음(step) 이벤트 가중 추첨(순수). 보스는 층 끝에서 별도 처리(run.ts).
import { weightedPick, type Roll } from "./rng";
import type { EventKind } from "./types";

export type RandomEvent = Exclude<EventKind, "boss">;

const WEIGHTS: readonly { item: RandomEvent; weight: number }[] = [
  { item: "combat", weight: 50 },
  { item: "treasure", weight: 18 },
  { item: "shop", weight: 12 },
  { item: "rest", weight: 12 },
  { item: "trap", weight: 8 },
];

export function drawEvent(seed: number): Roll<RandomEvent> {
  return weightedPick(seed, WEIGHTS);
}

// 휴식 세부 결과: 일반 회복 / 모닥불(전체 회복) / 약초(물약 획득).
export type RestKind = "heal" | "campfire" | "herb";
const REST_WEIGHTS: readonly { item: RestKind; weight: number }[] = [
  { item: "heal", weight: 60 },
  { item: "campfire", weight: 20 },
  { item: "herb", weight: 20 },
];
export function drawRest(seed: number): Roll<RestKind> {
  return weightedPick(seed, REST_WEIGHTS);
}

// 함정 세부 결과: 피해 / 골드 상실.
export type TrapKind = "damage" | "gold";
const TRAP_WEIGHTS: readonly { item: TrapKind; weight: number }[] = [
  { item: "damage", weight: 70 },
  { item: "gold", weight: 30 },
];
export function drawTrap(seed: number): Roll<TrapKind> {
  return weightedPick(seed, TRAP_WEIGHTS);
}
