// 이동 가능 범위(다익스트라) + 경로 복원. 비용=도착 타일 이동코스트 합.
// 통행불가(물/벽) 제외, 적 유닛은 통과 불가, 아군은 통과 가능하나 그 칸에 정지 불가.
import { inBounds, key, neighbors4, terrainAt, unitAt } from "./grid";
import { TERRAIN, type Coord, type GameState, type Unit } from "./types";
import { statOf } from "./types";

export type Reach = { coord: Coord; cost: number };

// unit이 이번 턴 도달(정지)할 수 있는 칸 → key→Reach. 시작 칸(cost 0) 포함.
export function reachable(state: GameState, unit: Unit): Map<string, Reach> {
  const mov = statOf(unit).mov;
  const start: Coord = { col: unit.col, row: unit.row };
  const best = new Map<string, number>([[key(start), 0]]);
  // 작은 격자라 단순 우선순위 루프(비용 오름차순)로 충분.
  const frontier: Reach[] = [{ coord: start, cost: 0 }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    if (cur.cost > (best.get(key(cur.coord)) ?? Infinity)) continue;
    for (const n of neighbors4(state.map, cur.coord)) {
      const info = TERRAIN[terrainAt(state.map, n)];
      if (!info.passable || info.moveCost === null) continue;
      const occupant = unitAt(state, n);
      // 적이 점유한 칸은 통과 불가. 아군 칸은 통과만 허용(정지 불가는 결과에서 거름).
      if (occupant && occupant.faction !== unit.faction) continue;
      const next = cur.cost + info.moveCost;
      if (next > mov) continue;
      if (next < (best.get(key(n)) ?? Infinity)) {
        best.set(key(n), next);
        frontier.push({ coord: n, cost: next });
      }
    }
  }

  // 정지 가능 칸만: 시작 칸이거나 비어 있는 칸(다른 유닛이 점유한 칸엔 못 멈춤).
  const result = new Map<string, Reach>();
  for (const [k, cost] of best) {
    const [col, row] = k.split(",").map(Number);
    const coord = { col, row };
    const occ = unitAt(state, coord);
    const isStart = col === start.col && row === start.row;
    if (isStart || !occ) result.set(k, { coord, cost });
  }
  return result;
}

// 시작→to 최단 경로(좌표 배열, 시작 포함). 도달 불가면 null. 렌더/이동 애니용.
export function findPath(
  state: GameState,
  unit: Unit,
  to: Coord,
): Coord[] | null {
  const mov = statOf(unit).mov;
  const start: Coord = { col: unit.col, row: unit.row };
  const best = new Map<string, number>([[key(start), 0]]);
  const prev = new Map<string, Coord>();
  const frontier: Reach[] = [{ coord: start, cost: 0 }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    if (cur.cost > (best.get(key(cur.coord)) ?? Infinity)) continue;
    for (const n of neighbors4(state.map, cur.coord)) {
      const info = TERRAIN[terrainAt(state.map, n)];
      if (!info.passable || info.moveCost === null) continue;
      const occupant = unitAt(state, n);
      if (occupant && occupant.faction !== unit.faction) continue;
      const next = cur.cost + info.moveCost;
      if (next > mov) continue;
      if (next < (best.get(key(n)) ?? Infinity)) {
        best.set(key(n), next);
        prev.set(key(n), cur.coord);
        frontier.push({ coord: n, cost: next });
      }
    }
  }

  if (!inBounds(state.map, to) || !best.has(key(to))) return null;
  // 도착 칸은 정지 가능해야(시작이거나 빈 칸).
  const occ = unitAt(state, to);
  const isStart = to.col === start.col && to.row === start.row;
  if (occ && !isStart) return null;

  const path: Coord[] = [];
  let at: Coord | undefined = to;
  while (at) {
    path.unshift(at);
    at = prev.get(key(at));
  }
  return path;
}
