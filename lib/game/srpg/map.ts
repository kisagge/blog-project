// 맵 데이터(JSON-호환) 로더/검증 + 유닛 배치. 맵을 데이터로 분리해 추후 .json·에디터 전환 용이.
import {
  CLASS_STATS,
  TERRAIN_INDEX,
  type Faction,
  type GameMap,
  type Terrain,
  type Unit,
  type UnitClass,
} from "./types";

export type RawUnit = {
  faction: Faction;
  cls: UnitClass;
  col: number;
  row: number;
};

// JSON-호환 원시 맵. tiles는 지형 enum 인덱스(TERRAIN_INDEX).
export type RawMap = {
  id: string;
  name: string;
  cols: number;
  rows: number;
  tiles: number[][]; // [row][col] enum 인덱스
  units: RawUnit[];
};

// 원시 맵을 검증·변환해 GameMap 생성. 차원·인덱스 오류는 throw.
export function loadMap(raw: RawMap): GameMap {
  if (raw.cols <= 0 || raw.rows <= 0) {
    throw new Error("맵 차원이 올바르지 않습니다.");
  }
  if (raw.tiles.length !== raw.rows) {
    throw new Error(`tiles 행 수가 rows(${raw.rows})와 다릅니다.`);
  }
  const tiles: Terrain[][] = raw.tiles.map((line, r) => {
    if (line.length !== raw.cols) {
      throw new Error(`tiles[${r}] 열 수가 cols(${raw.cols})와 다릅니다.`);
    }
    return line.map((idx) => {
      const terrain = TERRAIN_INDEX[idx];
      if (!terrain) throw new Error(`알 수 없는 지형 인덱스: ${idx}`);
      return terrain;
    });
  });
  return { id: raw.id, name: raw.name, cols: raw.cols, rows: raw.rows, tiles };
}

// 원시 유닛을 전투 유닛으로(시작 hp=maxHp, 플래그 false, 진영별 id 부여).
export function createUnits(raw: RawMap): Unit[] {
  const counter: Record<Faction, number> = { dawn: 0, ashen: 0 };
  return raw.units.map((u) => {
    const idx = counter[u.faction]++;
    return {
      id: `${u.faction}-${idx}`,
      faction: u.faction,
      cls: u.cls,
      col: u.col,
      row: u.row,
      hp: CLASS_STATS[u.cls].maxHp,
      moved: false,
      acted: false,
    };
  });
}
