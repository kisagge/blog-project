// 사거리·AoE 계산. 순수(맵 경계는 호출부가 교차).
import { manhattan, neighbors4 } from "./grid";
import { statOf, type Coord, type GameState, type Unit } from "./types";

// from에서 맨해튼 1..rng인 좌표(맵 경계 무관). 사거리 1 = 인접 4칸.
export function attackableCoords(from: Coord, rng: number): Coord[] {
  const out: Coord[] = [];
  for (let dc = -rng; dc <= rng; dc++) {
    for (let dr = -rng; dr <= rng; dr++) {
      const d = Math.abs(dc) + Math.abs(dr);
      if (d >= 1 && d <= rng)
        out.push({ col: from.col + dc, row: from.row + dr });
    }
  }
  return out;
}

// 법사 AoE: 중심 + 상하좌우 4칸(맵 경계 내).
export function aoeCoords(state: GameState, center: Coord): Coord[] {
  return [center, ...neighbors4(state.map, center)];
}

// fromCoord에 선 unit의 사거리 안에 있는 적 유닛들.
export function enemiesInRange(
  state: GameState,
  unit: Unit,
  fromCoord: Coord,
): Unit[] {
  const rng = statOf(unit).rng;
  return state.units.filter(
    (u) =>
      u.hp > 0 &&
      u.faction !== unit.faction &&
      manhattan(fromCoord, { col: u.col, row: u.row }) >= 1 &&
      manhattan(fromCoord, { col: u.col, row: u.row }) <= rng,
  );
}
