// 던전 구조 헬퍼(순수). 층 = STEPS_PER_FLOOR 걸음, 마지막 걸음은 보스.
import { STEPS_PER_FLOOR } from "./types";

export function isBossStep(step: number): boolean {
  return step >= STEPS_PER_FLOOR;
}

export function floorIntro(depth: number): string {
  return `${depth}층. 더 깊고 차가운 어둠이 당신을 맞는다.`;
}
