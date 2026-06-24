// SRPG(에테르 택틱스) 순수 도메인 타입 + 상수 테이블. three/DB/server-only 의존 0.
// 설계: docs/games/srpg-design.md. 결정론(난수 없음)·불변 업데이트가 원칙.

export type Faction = "dawn" | "ashen";
export type UnitClass = "warrior" | "archer" | "mage" | "cleric";
export type Terrain = "plain" | "forest" | "hill" | "water" | "wall";

export type Coord = { col: number; row: number };

export type Unit = {
  id: string;
  faction: Faction;
  cls: UnitClass;
  col: number;
  row: number;
  hp: number; // 현재 HP. 최대치·그 외 스탯은 CLASS_STATS에서 파생.
  moved: boolean; // 이번 턴 이동 사용 여부
  acted: boolean; // 이번 턴 행동(공격/치유/대기) 사용 여부 → true면 그 유닛 턴 종료
};

// 데미지 계산 분기. cleric은 행동으로 heal(아군) 또는 약한 근접 physical 공격 둘 다 가능.
export type DamageKind = "physical" | "magic" | "heal";

export type ClassStat = {
  maxHp: number;
  atk: number;
  def: number;
  mov: number;
  rng: number;
  kind: DamageKind;
};

// 기획서 §3 클래스 표 그대로. 밸런스는 살아있는 값(추후 조정).
export const CLASS_STATS: Record<UnitClass, ClassStat> = {
  warrior: { maxHp: 28, atk: 9, def: 5, mov: 4, rng: 1, kind: "physical" },
  archer: { maxHp: 18, atk: 8, def: 2, mov: 4, rng: 2, kind: "physical" },
  mage: { maxHp: 16, atk: 10, def: 1, mov: 3, rng: 2, kind: "magic" },
  cleric: { maxHp: 20, atk: 4, def: 3, mov: 4, rng: 1, kind: "heal" },
};

export type TerrainInfo = {
  moveCost: number | null; // null = 통행 불가
  def: number; // 물리 데미지 경감(지형 방어). 마법은 지형 무시(기획서 §5).
  passable: boolean;
};

// 기획서 §6 지형 표.
export const TERRAIN: Record<Terrain, TerrainInfo> = {
  plain: { moveCost: 1, def: 0, passable: true },
  forest: { moveCost: 2, def: 1, passable: true },
  hill: { moveCost: 2, def: 1, passable: true },
  water: { moveCost: null, def: 0, passable: false },
  wall: { moveCost: null, def: 0, passable: false },
};

// 맵 JSON의 tile enum 인덱스 ↔ Terrain.
export const TERRAIN_INDEX: Terrain[] = [
  "plain",
  "forest",
  "hill",
  "water",
  "wall",
];

export type GameMap = {
  id: string;
  name: string;
  cols: number;
  rows: number;
  tiles: Terrain[][]; // [row][col]
};

export type GameResult = "ongoing" | "dawn-win" | "ashen-win";

export type GameState = {
  map: GameMap;
  units: Unit[];
  phase: Faction; // 현재 행동 진영
  round: number; // 1부터. dawn 페이즈 복귀 시 +1
  result: GameResult;
};

export type Action =
  | { type: "move"; unitId: string; to: Coord }
  | { type: "attack"; unitId: string; target: Coord }
  | { type: "heal"; unitId: string; target: Coord }
  | { type: "wait"; unitId: string }
  | { type: "endPhase" };

// 파생 스탯 헬퍼(클래스 테이블 조회).
export function statOf(unit: Unit): ClassStat {
  return CLASS_STATS[unit.cls];
}

export function enemyOf(faction: Faction): Faction {
  return faction === "dawn" ? "ashen" : "dawn";
}
