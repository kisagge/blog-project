// 점수 산정(순수). 깊이·처치·골드 가중. 리더보드·결과 표시 공용.
import { SCORE, type RunState } from "./types";

// 스탯만으로 점수 산정 — 서버가 클라 제출값을 재계산할 때 공용(임의 점수 주입 차단).
export function scoreFromStats(
  depth: number,
  kills: number,
  gold: number,
): number {
  return depth * SCORE.perDepth + kills * SCORE.perKill + gold;
}

export function computeScore(s: RunState): number {
  return scoreFromStats(s.depth, s.kills, s.player.gold);
}
