// 전투 해결(결정론, 기획서 §5 공식). 모두 불변 — 새 GameState 반환.
import { manhattan, neighbors4, terrainAt, unitAt } from "./grid";
import {
  TERRAIN,
  statOf,
  type Coord,
  type GameState,
  type Unit,
} from "./types";

// 물리: 유닛 방어 + 지형 방어를 모두 경감. 최소 1.
export function physicalDamage(
  atk: number,
  def: number,
  terrainDef: number,
): number {
  return Math.max(1, atk - (def + terrainDef));
}

// 마법: 유닛 방어 절반만 경감(지형 무시 — "엄폐를 관통"). 최소 1.
export function magicDamage(atk: number, def: number): number {
  return Math.max(1, atk - Math.floor(def / 2));
}

// 치유량(최대 hp 초과는 호출부에서 캡).
export function healAmount(atk: number): number {
  return atk + 4;
}

// 유닛 hp를 불변으로 갱신(0 미만은 0으로 클램프 = 사망). 죽은 유닛은 배열에 남되 hp 0.
function withHp(state: GameState, unitId: string, hp: number): GameState {
  return {
    ...state,
    units: state.units.map((u) =>
      u.id === unitId ? { ...u, hp: Math.max(0, hp) } : u,
    ),
  };
}

function find(state: GameState, id: string): Unit {
  const u = state.units.find((x) => x.id === id);
  if (!u) throw new Error(`유닛 없음: ${id}`);
  return u;
}

// 한 대상에 대한 단일 타격 데미지(공격자 종류에 따라 물리/마법). cleric은 공격 시 물리.
function strike(attacker: Unit, defender: Unit, state: GameState): number {
  const a = statOf(attacker);
  if (a.kind === "magic") return magicDamage(a.atk, statOf(defender).def);
  const terrainDef = TERRAIN[terrainAt(state.map, defender)].def;
  return physicalDamage(a.atk, statOf(defender).def, terrainDef);
}

// 공격 해결: 주 대상 타격 → (법사면) 인접 적 splash 50% → 주 대상 생존+사거리 내면 1회 반격.
// 무효 입력(공격자 사망·대상에 적 없음)은 throw. acted/턴 종료·result 갱신은 state.ts가 담당.
export function resolveAttack(
  state: GameState,
  attackerId: string,
  target: Coord,
): GameState {
  const attacker = find(state, attackerId);
  if (attacker.hp <= 0) throw new Error("사망한 유닛은 공격 불가");
  const primary = unitAt(state, target);
  if (!primary || primary.faction === attacker.faction) {
    throw new Error("대상 칸에 적 유닛이 없습니다.");
  }

  let next = state;
  // 1) 주 대상 타격
  const primaryDmg = strike(attacker, primary, next);
  next = withHp(next, primary.id, primary.hp - primaryDmg);

  // 2) 법사 AoE: 인접 4칸의 다른 적에게 절반(내림)
  if (statOf(attacker).kind === "magic") {
    for (const c of neighbors4(next.map, target)) {
      const splashTarget = unitAt(next, c);
      if (
        splashTarget &&
        splashTarget.faction !== attacker.faction &&
        splashTarget.id !== primary.id
      ) {
        const dmg = Math.floor(
          magicDamage(statOf(attacker).atk, statOf(splashTarget).def) / 2,
        );
        if (dmg > 0) {
          next = withHp(next, splashTarget.id, splashTarget.hp - dmg);
        }
      }
    }
  }

  // 3) 반격: 주 대상이 생존 + 공격자가 대상 사거리 내면 1회(대상 공식). AoE 2차·heal은 반격 없음.
  const primaryAfter = find(next, primary.id);
  const attackerPos: Coord = { col: attacker.col, row: attacker.row };
  if (
    primaryAfter.hp > 0 &&
    manhattan({ col: primaryAfter.col, row: primaryAfter.row }, attackerPos) <=
      statOf(primaryAfter).rng
  ) {
    const counterDmg = strike(primaryAfter, attacker, next);
    next = withHp(next, attacker.id, attacker.hp - counterDmg);
  }

  return next;
}

// 치유 해결: 대상 아군 hp를 healAmount만큼 회복(최대치 캡). 무효 입력은 throw.
export function resolveHeal(
  state: GameState,
  healerId: string,
  target: Coord,
): GameState {
  const healer = find(state, healerId);
  if (healer.hp <= 0) throw new Error("사망한 유닛은 치유 불가");
  const ally = unitAt(state, target);
  if (!ally || ally.faction !== healer.faction) {
    throw new Error("대상 칸에 아군이 없습니다.");
  }
  const healed = Math.min(
    statOf(ally).maxHp,
    ally.hp + healAmount(statOf(healer).atk),
  );
  return withHp(state, ally.id, healed);
}
