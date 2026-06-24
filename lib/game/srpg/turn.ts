// 페이즈 전환·승패 판정. 순수·불변.
import { enemyOf, type Faction, type GameState } from "./types";

function aliveCount(state: GameState, faction: Faction): number {
  return state.units.filter((u) => u.hp > 0 && u.faction === faction).length;
}

// 한 진영 전멸이면 상대 승리. 둘 다 살아있으면 ongoing. (rout 목표 — 기획서 MVP)
export function evaluate(state: GameState): GameState {
  const dawn = aliveCount(state, "dawn");
  const ashen = aliveCount(state, "ashen");
  let result: GameState["result"] = "ongoing";
  if (ashen === 0) result = "dawn-win";
  else if (dawn === 0) result = "ashen-win";
  return result === state.result ? state : { ...state, result };
}

// 페이즈 종료: 진영 토글 + 전 유닛 moved/acted 리셋. ashen→dawn 복귀 시 라운드 +1.
export function endPhase(state: GameState): GameState {
  const phase = enemyOf(state.phase);
  const round = phase === "dawn" ? state.round + 1 : state.round;
  return {
    ...state,
    phase,
    round,
    units: state.units.map((u) => ({ ...u, moved: false, acted: false })),
  };
}
