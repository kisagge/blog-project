// 테스트 전용 빌더(순수). vitest는 *.test.* 만 수집하므로 이 파일은 테스트로 실행되지 않는다.
import {
  CLASS_STATS,
  type Faction,
  type GameMap,
  type GameState,
  type Terrain,
  type Unit,
  type UnitClass,
} from "./types";

export function plainMap(cols: number, rows: number, id = "t"): GameMap {
  const tiles: Terrain[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => "plain" as Terrain),
  );
  return { id, name: id, cols, rows, tiles };
}

export function unit(
  id: string,
  faction: Faction,
  cls: UnitClass,
  col: number,
  row: number,
  over: Partial<Unit> = {},
): Unit {
  return {
    id,
    faction,
    cls,
    col,
    row,
    hp: CLASS_STATS[cls].maxHp,
    moved: false,
    acted: false,
    ...over,
  };
}

export function game(
  map: GameMap,
  units: Unit[],
  over: Partial<GameState> = {},
): GameState {
  return { map, units, phase: "dawn", round: 1, result: "ongoing", ...over };
}
