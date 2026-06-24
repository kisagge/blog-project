// 적 페이즈 AI: 그리디·완전 결정론(난수 없음, 안정 타이브레이크). 렌더 없이 한 페이즈를 진행.
import { physicalDamage, magicDamage } from "./combat";
import { manhattan, terrainAt } from "./grid";
import { reachable } from "./pathfinding";
import { reduce } from "./state";
import {
  TERRAIN,
  statOf,
  type Action,
  type Coord,
  type GameState,
  type Unit,
} from "./types";

function coordCmp(a: Coord, b: Coord): number {
  return a.col - b.col || a.row - b.row;
}

function terrainDef(state: GameState, c: Coord): number {
  return TERRAIN[terrainAt(state.map, c)].def;
}

// 공격자가 대상에게 줄 예상 데미지(결정론, 지형 반영).
function predictedDamage(
  state: GameState,
  attacker: Unit,
  defender: Unit,
): number {
  const a = statOf(attacker);
  const d = statOf(defender);
  if (a.kind === "magic") return magicDamage(a.atk, d.def);
  return physicalDamage(
    a.atk,
    d.def,
    terrainDef(state, { col: defender.col, row: defender.row }),
  );
}

// unit이 이번 턴 정지 가능한 칸들(이미 이동했으면 현재 칸만). 현재 칸 포함.
function tiles(state: GameState, unit: Unit): Coord[] {
  if (unit.moved) return [{ col: unit.col, row: unit.row }];
  return [...reachable(state, unit).values()].map((r) => r.coord);
}

function isHere(unit: Unit, c: Coord): boolean {
  return unit.col === c.col && unit.row === c.row;
}

// 공격형(전사·궁수·법사, 그리고 근접 가능한 치유사도 비치유 시) 다음 행동.
function attackerAction(state: GameState, unit: Unit): Action {
  const rng = statOf(unit).rng;
  const enemies = state.units.filter(
    (u) => u.hp > 0 && u.faction !== unit.faction,
  );

  // (tile, enemy) 후보 중 최적: 처치 가능 > 데미지 > 대상 저hp > 지형방어 > 좌표.
  let best: {
    tile: Coord;
    enemy: Unit;
    dmg: number;
    kills: boolean;
    tdef: number;
  } | null = null;
  for (const tile of tiles(state, unit).sort(coordCmp)) {
    for (const enemy of enemies) {
      const dist = manhattan(tile, { col: enemy.col, row: enemy.row });
      if (dist < 1 || dist > rng) continue;
      const dmg = predictedDamage(state, unit, enemy);
      const kills = dmg >= enemy.hp;
      const tdef = terrainDef(state, tile);
      const cand = { tile, enemy, dmg, kills, tdef };
      if (
        !best ||
        Number(kills) - Number(best.kills) > 0 ||
        (kills === best.kills &&
          (dmg > best.dmg ||
            (dmg === best.dmg &&
              (enemy.hp < best.enemy.hp ||
                (enemy.hp === best.enemy.hp &&
                  (tdef > best.tdef ||
                    (tdef === best.tdef && coordCmp(tile, best.tile) < 0)))))))
      ) {
        best = cand;
      }
    }
  }

  if (best) {
    if (isHere(unit, best.tile)) {
      return {
        type: "attack",
        unitId: unit.id,
        target: { col: best.enemy.col, row: best.enemy.row },
      };
    }
    return { type: "move", unitId: unit.id, to: best.tile };
  }

  // 타격 불가: 최근접 적 쪽으로 접근(이동 안 했으면). 더 못 가까워지면 대기.
  if (!unit.moved && enemies.length > 0) {
    const here: Coord = { col: unit.col, row: unit.row };
    const nearest = [...enemies].sort(
      (a, b) =>
        manhattan(here, { col: a.col, row: a.row }) -
          manhattan(here, { col: b.col, row: b.row }) ||
        coordCmp({ col: a.col, row: a.row }, { col: b.col, row: b.row }),
    )[0];
    const target: Coord = { col: nearest.col, row: nearest.row };
    let bestTile: Coord = here;
    let bestD = manhattan(here, target);
    let bestTdef = terrainDef(state, here);
    for (const tile of tiles(state, unit).sort(coordCmp)) {
      const d = manhattan(tile, target);
      const tdef = terrainDef(state, tile);
      if (d < bestD || (d === bestD && tdef > bestTdef)) {
        bestTile = tile;
        bestD = d;
        bestTdef = tdef;
      }
    }
    if (!isHere(unit, bestTile))
      return { type: "move", unitId: unit.id, to: bestTile };
  }
  return { type: "wait", unitId: unit.id };
}

// 치유형(치유사): 부상 아군 우선 회복, 없으면 부상/최근접 아군 쪽으로 이동, 아니면 대기.
function clericAction(state: GameState, unit: Unit): Action {
  const rng = statOf(unit).rng;
  const wounded = state.units.filter(
    (u) =>
      u.hp > 0 &&
      u.faction === unit.faction &&
      u.id !== unit.id &&
      u.hp < statOf(u).maxHp,
  );

  if (wounded.length > 0) {
    let best: { tile: Coord; ally: Unit; missing: number } | null = null;
    for (const tile of tiles(state, unit).sort(coordCmp)) {
      for (const ally of wounded) {
        if (manhattan(tile, { col: ally.col, row: ally.row }) > rng) continue;
        const missing = statOf(ally).maxHp - ally.hp;
        const cand = { tile, ally, missing };
        if (
          !best ||
          missing > best.missing ||
          (missing === best.missing &&
            (coordCmp(
              { col: ally.col, row: ally.row },
              { col: best.ally.col, row: best.ally.row },
            ) < 0 ||
              coordCmp(tile, best.tile) < 0))
        ) {
          best = cand;
        }
      }
    }
    if (best) {
      if (isHere(unit, best.tile)) {
        return {
          type: "heal",
          unitId: unit.id,
          target: { col: best.ally.col, row: best.ally.row },
        };
      }
      return { type: "move", unitId: unit.id, to: best.tile };
    }
    // 회복 사거리 밖: 가장 부상 큰 아군 쪽으로 접근.
    if (!unit.moved) {
      const here: Coord = { col: unit.col, row: unit.row };
      const target = [...wounded].sort(
        (a, b) =>
          statOf(b).maxHp - b.hp - (statOf(a).maxHp - a.hp) ||
          coordCmp({ col: a.col, row: a.row }, { col: b.col, row: b.row }),
      )[0];
      const goal: Coord = { col: target.col, row: target.row };
      let bestTile = here;
      let bestD = manhattan(here, goal);
      for (const tile of tiles(state, unit).sort(coordCmp)) {
        const d = manhattan(tile, goal);
        if (d < bestD) {
          bestTile = tile;
          bestD = d;
        }
      }
      if (!isHere(unit, bestTile))
        return { type: "move", unitId: unit.id, to: bestTile };
    }
  }
  return { type: "wait", unitId: unit.id };
}

// 한 유닛의 다음 단일 행동(이동/공격/치유/대기).
export function chooseAction(state: GameState, unitId: string): Action {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) throw new Error(`유닛 없음: ${unitId}`);
  return statOf(unit).kind === "heal"
    ? clericAction(state, unit)
    : attackerAction(state, unit);
}

// 적(ashen) 페이즈 전체를 결정론적으로 진행: 각 유닛 (이동→행동) 후 페이즈 종료.
export function runAshenPhase(state: GameState): GameState {
  if (state.phase !== "ashen") throw new Error("ashen 페이즈가 아닙니다.");
  let s = state;
  const ids = s.units
    .filter((u) => u.hp > 0 && u.faction === "ashen")
    .map((u) => u.id)
    .sort();

  for (const id of ids) {
    // 유닛당 최대 2액션(이동+행동). 안전 상한으로 무한루프 방지.
    for (let step = 0; step < 4; step++) {
      const u = s.units.find((x) => x.id === id);
      if (!u || u.hp <= 0 || u.acted) break;
      if (s.result !== "ongoing") break;
      const action = chooseAction(s, id);
      s = reduce(s, action);
      if (action.type !== "move") break; // 행동/대기면 유닛 턴 종료
    }
    if (s.result !== "ongoing") return s; // 도중 승패 확정 시 페이즈 종료 생략
  }

  return reduce(s, { type: "endPhase" });
}
