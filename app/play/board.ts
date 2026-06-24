// 보드 렌더 매핑(순수 — three 의존 0, 단위 테스트 대상). 지형 시각 + 격자→월드 좌표.
import type { Coord, GameMap, Terrain } from "@/lib/game/srpg/types";

export type TileVisual = { color: number; height: number };

// 지형별 색(0xRRGGBB)·높이(2.5D 입체). 물은 가라앉고 벽이 가장 높다.
const TILE_VISUAL: Record<Terrain, TileVisual> = {
  plain: { color: 0x6b8e5a, height: 0.2 },
  forest: { color: 0x2f6d3a, height: 0.5 },
  hill: { color: 0x9c7a4d, height: 0.7 },
  water: { color: 0x3a6ea5, height: 0.1 },
  wall: { color: 0x4a4a52, height: 1.0 },
};

export function tileVisual(terrain: Terrain): TileVisual {
  return TILE_VISUAL[terrain];
}

// 타일 1칸 = 1월드유닛. 보드를 원점 중심으로 정렬(col→x, row→z).
export const TILE_SIZE = 1;

export function worldPos(coord: Coord, map: GameMap): { x: number; z: number } {
  return {
    x: (coord.col - (map.cols - 1) / 2) * TILE_SIZE,
    z: (coord.row - (map.rows - 1) / 2) * TILE_SIZE,
  };
}
