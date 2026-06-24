// 순수 격자 유틸. 좌표·거리·이웃·점유 조회.
import type { Coord, GameMap, GameState, Terrain, Unit } from "./types";

export function eq(a: Coord, b: Coord): boolean {
  return a.col === b.col && a.row === b.row;
}

// Map 키·dedup용 안정 문자열.
export function key(c: Coord): string {
  return `${c.col},${c.row}`;
}

export function inBounds(map: GameMap, c: Coord): boolean {
  return c.col >= 0 && c.row >= 0 && c.col < map.cols && c.row < map.rows;
}

export function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

export function terrainAt(map: GameMap, c: Coord): Terrain {
  return map.tiles[c.row][c.col];
}

// 맵 경계 내 상하좌우 이웃(결정론 순서: 위·아래·좌·우).
export function neighbors4(map: GameMap, c: Coord): Coord[] {
  const cand: Coord[] = [
    { col: c.col, row: c.row - 1 },
    { col: c.col, row: c.row + 1 },
    { col: c.col - 1, row: c.row },
    { col: c.col + 1, row: c.row },
  ];
  return cand.filter((n) => inBounds(map, n));
}

// 해당 칸의 살아있는 유닛(hp>0). 없으면 undefined.
export function unitAt(state: GameState, c: Coord): Unit | undefined {
  return state.units.find(
    (u) => u.hp > 0 && u.col === c.col && u.row === c.row,
  );
}
