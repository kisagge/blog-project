// 던전 구조 헬퍼(순수). 층 = STEPS_PER_FLOOR 걸음, 마지막 걸음은 보스.
import { STEPS_PER_FLOOR } from "./types";

export function isBossStep(step: number): boolean {
  return step >= STEPS_PER_FLOOR;
}

// 층 분위기 텍스트(깊이 기반 순환 — 무작위 아님, 같은 깊이 = 같은 문장).
const FLOOR_FLAVORS: readonly string[] = [
  "더 깊고 차가운 어둠이 당신을 맞는다.",
  "물 떨어지는 소리. 어둠 속에서 무언가가 당신을 봤다.",
  "오래된 뼈가 발밑에서 바스러진다.",
  "공기가 무겁다. 멀리서 낮은 울음이 들린다.",
  "벽을 따라 희미한 인광이 번진다.",
];

export function floorIntro(depth: number): string {
  const flavor = FLOOR_FLAVORS[(depth - 1) % FLOOR_FLAVORS.length];
  return `${depth}층. ${flavor}`;
}
