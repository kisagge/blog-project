// SRPG 플레이 상호작용 상태기계(순수 — three/DOM 0). 마우스·키보드·SR·테스트 공용.
// 규칙은 lib/game/srpg 엔진이 강제, 여기선 "선택→이동/공격" UI 흐름만 결정론적으로 엮는다.
import {
  createGame,
  legalAttacks,
  legalMoves,
  reduce,
} from "@/lib/game/srpg/state";
import { runAshenPhase } from "@/lib/game/srpg/ai";
import { resolveAttack } from "@/lib/game/srpg/combat";
import { eq, manhattan, terrainAt, unitAt } from "@/lib/game/srpg/grid";
import { SKIRMISH_01 } from "@/lib/game/srpg/maps/skirmish-01";
import type { RawMap } from "@/lib/game/srpg/map";
import {
  statOf,
  type Coord,
  type Faction,
  type GameResult,
  type GameState,
  type Terrain,
  type Unit,
  type UnitClass,
} from "@/lib/game/srpg/types";

export type UiState = { game: GameState; selectedId: string | null };
export type Step = { ui: UiState; announce?: string };

export const FACTION_KO: Record<Faction, string> = {
  dawn: "여명단",
  ashen: "잿더미단",
};
export const CLASS_KO: Record<UnitClass, string> = {
  warrior: "전사",
  archer: "궁수",
  mage: "법사",
  cleric: "치유사",
};
const TERRAIN_KO: Record<Terrain, string> = {
  plain: "평지",
  forest: "숲",
  hill: "언덕",
  water: "물",
  wall: "벽",
};

const label = (u: Unit) => `${FACTION_KO[u.faction]} ${CLASS_KO[u.cls]}`;
const at = (c: Coord) => `(${c.col},${c.row})`;

export function newGame(raw: RawMap = SKIRMISH_01): UiState {
  return { game: createGame(raw), selectedId: null };
}

export function selectedUnit(ui: UiState): Unit | null {
  if (!ui.selectedId) return null;
  return ui.game.units.find((u) => u.id === ui.selectedId && u.hp > 0) ?? null;
}

// 플레이어 차례에 상호작용 가능한가(내 페이즈 + 진행 중).
function active(game: GameState): boolean {
  return game.result === "ongoing" && game.phase === "dawn";
}

function has(list: Coord[], c: Coord): boolean {
  return list.some((x) => eq(x, c));
}

export function resultText(result: GameResult): string {
  if (result === "dawn-win") return "승리! 잿더미단을 모두 물리쳤습니다.";
  if (result === "ashen-win") return "패배… 여명단이 전멸했습니다.";
  return "";
}

// 칸 클릭/Enter 단일 핸들러.
export function selectAt(ui: UiState, coord: Coord): Step {
  const { game } = ui;
  if (!active(game)) return { ui };

  const clicked = unitAt(game, coord);
  const sel = selectedUnit(ui);

  // 선택 없음: 미행동 아군이면 선택.
  if (!sel) {
    if (clicked && clicked.faction === "dawn" && !clicked.acted) {
      return {
        ui: { game, selectedId: clicked.id },
        announce: `${label(clicked)} 선택`,
      };
    }
    return { ui };
  }

  // 같은 유닛 재클릭 → 해제.
  if (clicked && clicked.id === sel.id) {
    return { ui: { game, selectedId: null }, announce: "선택 해제" };
  }

  // 이동: 미이동 + 도달 가능 칸.
  if (!sel.moved && has(legalMoves(game, sel.id), coord)) {
    const next = reduce(game, { type: "move", unitId: sel.id, to: coord });
    return {
      ui: { game: next, selectedId: sel.id },
      announce: `이동 ${at(coord)}`,
    };
  }

  // 공격: 미행동 + 사거리 내 적.
  if (!sel.acted && clicked && has(legalAttacks(game, sel.id), coord)) {
    const before = clicked.hp;
    const next = reduce(game, {
      type: "attack",
      unitId: sel.id,
      target: coord,
    });
    const after = next.units.find((u) => u.id === clicked.id);
    const dmg = before - (after?.hp ?? 0);
    const dead = !after || after.hp <= 0;
    let announce = dead
      ? `${label(clicked)} 처치 (${dmg} 피해)`
      : `${label(clicked)}에게 ${dmg} 피해, HP ${after?.hp}`;
    if (next.result !== "ongoing") announce += ` — ${resultText(next.result)}`;
    return { ui: { game: next, selectedId: null }, announce };
  }

  // 다른 미행동 아군 → 선택 전환.
  if (clicked && clicked.faction === "dawn" && !clicked.acted) {
    return {
      ui: { game, selectedId: clicked.id },
      announce: `${label(clicked)} 선택`,
    };
  }

  return { ui: { game, selectedId: null }, announce: "선택 해제" };
}

// 선택 유닛 대기(이동만 했거나 그대로) → 턴 종료 처리.
export function waitSelected(ui: UiState): Step {
  const sel = selectedUnit(ui);
  if (!sel || !active(ui.game) || sel.acted) return { ui };
  const next = reduce(ui.game, { type: "wait", unitId: sel.id });
  return {
    ui: { game: next, selectedId: null },
    announce: `${label(sel)} 대기`,
  };
}

// 플레이어 페이즈 종료 → 적 AI 페이즈 자동 진행 → 내 턴 복귀(결정론).
export function endTurn(ui: UiState): Step {
  if (!active(ui.game)) return { ui };
  const ashen = reduce(ui.game, { type: "endPhase" });
  const next = runAshenPhase(ashen);
  let announce =
    next.result === "ongoing"
      ? `적 턴 종료. 라운드 ${next.round}, 여명단 차례.`
      : resultText(next.result);
  if (next.result === "ongoing") announce = `잿더미단 행동 완료. ${announce}`;
  return { ui: { game: next, selectedId: null }, announce };
}

// ── 파생(렌더·SR 공용, 순수) ──

export function moveTiles(ui: UiState): Coord[] {
  const sel = selectedUnit(ui);
  if (!sel || !active(ui.game) || sel.moved) return [];
  return legalMoves(ui.game, sel.id);
}

export function attackTiles(ui: UiState): Coord[] {
  const sel = selectedUnit(ui);
  if (!sel || !active(ui.game) || sel.acted) return [];
  return legalAttacks(ui.game, sel.id);
}

export type UnitSummary = {
  id: string;
  faction: Faction;
  cls: UnitClass;
  hp: number;
  maxHp: number;
  col: number;
  row: number;
  label: string;
};

export function unitSummaries(game: GameState): UnitSummary[] {
  return game.units
    .filter((u) => u.hp > 0)
    .map((u) => ({
      id: u.id,
      faction: u.faction,
      cls: u.cls,
      hp: u.hp,
      maxHp: statOf(u).maxHp,
      col: u.col,
      row: u.row,
      label: label(u),
    }));
}

// 커서 칸 설명(키보드 이동 시 aria-live).
export function cursorInfo(game: GameState, coord: Coord): string {
  const terrain = TERRAIN_KO[terrainAt(game.map, coord)];
  const u = unitAt(game, coord);
  const who = u ? `${label(u)} HP ${u.hp}/${statOf(u).maxHp}` : "빈 칸";
  return `${at(coord)} ${terrain}, ${who}`;
}

// 첫 아군 유닛 좌표(맵별 시작 커서). 없으면 (0,0).
export function firstDawnCoord(game: GameState): Coord {
  const u = game.units.find((x) => x.faction === "dawn" && x.hp > 0);
  return u ? { col: u.col, row: u.row } : { col: 0, row: 0 };
}

// 공격 전 예상치(실제 전투와 동일하게 resolveAttack로 시뮬레이션 후 diff). 무효면 null.
export type AttackPreview = { dmg: number; lethal: boolean; counter: number };
export function previewAttack(
  game: GameState,
  attackerId: string,
  target: Coord,
): AttackPreview | null {
  const attacker = game.units.find((u) => u.id === attackerId && u.hp > 0);
  const defender = unitAt(game, target);
  if (!attacker || !defender || defender.faction === attacker.faction) {
    return null;
  }
  const dist = manhattan({ col: attacker.col, row: attacker.row }, target);
  if (dist < 1 || dist > statOf(attacker).rng) return null;

  const next = resolveAttack(game, attackerId, target);
  const defAfter = next.units.find((u) => u.id === defender.id);
  const atkAfter = next.units.find((u) => u.id === attacker.id);
  return {
    dmg: defender.hp - (defAfter?.hp ?? 0),
    lethal: !defAfter || defAfter.hp <= 0,
    counter: attacker.hp - (atkAfter?.hp ?? attacker.hp),
  };
}

// 프리뷰 한국어 문장(HUD·aria-live 공용). 무효면 null.
export function previewText(
  game: GameState,
  attackerId: string,
  target: Coord,
): string | null {
  const p = previewAttack(game, attackerId, target);
  if (!p) return null;
  const u = unitAt(game, target);
  const who = u ? label(u) : "대상";
  const lethal = p.lethal ? " (처치)" : "";
  const counter = p.counter > 0 ? `, 반격 ${p.counter}` : "";
  return `${who}에게 ${p.dmg} 피해${lethal}${counter}`;
}
