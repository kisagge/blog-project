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
