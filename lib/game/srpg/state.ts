// 단일 진입 리듀서: (state, action) => state. 모든 규칙을 한 곳에서 강제(테스트·렌더·AI 공용).
import { resolveAttack, resolveHeal } from "./combat";
import { key, manhattan } from "./grid";
import { reachable } from "./pathfinding";
import { endPhase, evaluate } from "./turn";
import { createUnits, loadMap, type RawMap } from "./map";
import {
  statOf,
  type Action,
  type Coord,
  type GameState,
  type Unit,
} from "./types";

// 원시 맵 → 초기 상태(dawn 선공, 라운드 1).
export function createGame(raw: RawMap): GameState {
  return {
    map: loadMap(raw),
    units: createUnits(raw),
    phase: "dawn",
    round: 1,
    result: "ongoing",
  };
}

function requireUnit(state: GameState, id: string): Unit {
  const u = state.units.find((x) => x.id === id);
  if (!u) throw new Error(`유닛 없음: ${id}`);
  if (u.hp <= 0) throw new Error("사망한 유닛은 행동 불가");
  if (u.faction !== state.phase) throw new Error("상대 진영 유닛은 조작 불가");
  return u;
}

function setFlags(
  state: GameState,
  id: string,
  patch: Partial<Unit>,
): GameState {
  return {
    ...state,
    units: state.units.map((u) => (u.id === id ? { ...u, ...patch } : u)),
  };
}

// 단일 액션 적용. 무효 액션은 throw(테스트가 명확히 잡도록). 매 액션 후 result 갱신.
export function reduce(state: GameState, action: Action): GameState {
  if (action.type === "endPhase") return evaluate(endPhase(state));
  if (state.result !== "ongoing") throw new Error("이미 종료된 게임입니다.");

  const unit = requireUnit(state, action.unitId);
  const pos: Coord = { col: unit.col, row: unit.row };

  switch (action.type) {
    case "move": {
      if (unit.moved) throw new Error("이미 이동했습니다.");
      const reach = reachable(state, unit);
      if (!reach.has(key(action.to))) throw new Error("이동 불가 칸입니다.");
      return evaluate(
        setFlags(state, unit.id, {
          col: action.to.col,
          row: action.to.row,
          moved: true,
        }),
      );
    }
    case "attack": {
      if (unit.acted) throw new Error("이미 행동했습니다.");
      const dist = manhattan(pos, action.target);
      if (dist < 1 || dist > statOf(unit).rng) {
        throw new Error("사거리 밖입니다.");
      }
      const after = resolveAttack(state, unit.id, action.target);
      // 공격은 유닛 턴 종료(이동도 소모).
      return evaluate(setFlags(after, unit.id, { moved: true, acted: true }));
    }
    case "heal": {
      if (unit.acted) throw new Error("이미 행동했습니다.");
      if (statOf(unit).kind !== "heal")
        throw new Error("치유할 수 없는 클래스입니다.");
      const dist = manhattan(pos, action.target);
      if (dist > statOf(unit).rng) throw new Error("사거리 밖입니다.");
      const after = resolveHeal(state, unit.id, action.target);
      return evaluate(setFlags(after, unit.id, { moved: true, acted: true }));
    }
    case "wait": {
      if (unit.acted) throw new Error("이미 행동했습니다.");
      return setFlags(state, unit.id, { moved: true, acted: true });
    }
  }
}

// ── 렌더·AI 공용 순수 헬퍼 ──

// 해당 유닛이 이번 턴 이동 가능한 칸들(현재 진영·미이동일 때만).
export function legalMoves(state: GameState, unitId: string): Coord[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.hp <= 0 || unit.faction !== state.phase || unit.moved) {
    return [];
  }
  return [...reachable(state, unit).values()].map((r) => r.coord);
}

// 현재 위치에서 공격 가능한 적의 좌표들(미행동일 때만).
export function legalAttacks(state: GameState, unitId: string): Coord[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.hp <= 0 || unit.faction !== state.phase || unit.acted) {
    return [];
  }
  const rng = statOf(unit).rng;
  const pos: Coord = { col: unit.col, row: unit.row };
  return state.units
    .filter((u) => {
      if (u.hp <= 0 || u.faction === unit.faction) return false;
      const d = manhattan(pos, { col: u.col, row: u.row });
      return d >= 1 && d <= rng;
    })
    .map((u) => ({ col: u.col, row: u.row }));
}
