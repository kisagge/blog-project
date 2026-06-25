// 점수 산정(순수). 깊이·처치·골드 가중. 리더보드(추후 슬라이스)·결과 표시 공용.
import { SCORE, type RunState } from "./types";

export function computeScore(s: RunState): number {
  return s.depth * SCORE.perDepth + s.kills * SCORE.perKill + s.player.gold;
}
