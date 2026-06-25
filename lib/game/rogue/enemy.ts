// 적 테이블 + 깊이 스케일(순수). makeEnemy로 시드 기반 적 생성.
import { pick, type Roll } from "./rng";
import type { Enemy } from "./types";

type EnemyBase = {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  gold: number;
};

const ENEMIES: readonly EnemyBase[] = [
  { id: "goblin", name: "고블린", hp: 12, atk: 4, def: 1, xp: 8, gold: 5 },
  {
    id: "skeleton",
    name: "해골 병사",
    hp: 16,
    atk: 5,
    def: 2,
    xp: 10,
    gold: 7,
  },
  { id: "spider", name: "거대 거미", hp: 10, atk: 6, def: 0, xp: 9, gold: 4 },
  { id: "shade", name: "그림자", hp: 14, atk: 5, def: 1, xp: 11, gold: 6 },
];
const BOSS: EnemyBase = {
  id: "warden",
  name: "심연의 수문장",
  hp: 40,
  atk: 8,
  def: 3,
  xp: 40,
  gold: 30,
};

// 깊이로 스탯 스케일(층↑ → HP/ATK/DEF·보상↑). 결정론.
function scale(base: EnemyBase, depth: number, boss: boolean): Enemy {
  const f = 1 + 0.2 * (depth - 1);
  const hp = Math.round(base.hp * f);
  return {
    id: base.id,
    name: base.name,
    hp,
    maxHp: hp,
    atk: base.atk + Math.floor((depth - 1) / 2),
    def: base.def + Math.floor((depth - 1) / 3),
    xp: Math.round(base.xp * f),
    gold: Math.round(base.gold * f),
    boss,
  };
}

export function makeEnemy(
  seed: number,
  depth: number,
  boss: boolean,
): Roll<Enemy> {
  if (boss) return { value: scale(BOSS, depth, true), seed };
  const r = pick(seed, ENEMIES);
  return { value: scale(r.value, depth, false), seed: r.seed };
}
