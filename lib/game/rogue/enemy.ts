// 적·보스 테이블 + 깊이 스케일/게이팅(순수). makeEnemy로 시드 기반 적 생성.
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
  minDepth: number; // 이 깊이부터 등장
};

// 다양한 전투 성향(균형/유리대포/탱커/고방어). 깊을수록 강적이 풀린다.
const ENEMIES: readonly EnemyBase[] = [
  { id: "goblin", name: "고블린", hp: 12, atk: 4, def: 1, xp: 8, gold: 5, minDepth: 1 }, // prettier-ignore
  { id: "spider", name: "거대 거미", hp: 10, atk: 6, def: 0, xp: 9, gold: 4, minDepth: 1 }, // prettier-ignore
  { id: "skeleton", name: "해골 병사", hp: 16, atk: 5, def: 2, xp: 10, gold: 7, minDepth: 1 }, // prettier-ignore
  { id: "shade", name: "그림자", hp: 14, atk: 5, def: 1, xp: 11, gold: 6, minDepth: 2 }, // prettier-ignore
  { id: "bat", name: "심연 박쥐", hp: 9, atk: 8, def: 0, xp: 12, gold: 5, minDepth: 2 }, // prettier-ignore
  { id: "ghoul", name: "굶주린 망령", hp: 22, atk: 6, def: 1, xp: 15, gold: 9, minDepth: 3 }, // prettier-ignore
  { id: "golem", name: "돌 골렘", hp: 28, atk: 5, def: 4, xp: 18, gold: 12, minDepth: 4 }, // prettier-ignore
  { id: "knight", name: "부패한 기사", hp: 24, atk: 9, def: 3, xp: 22, gold: 15, minDepth: 5 }, // prettier-ignore
];

// 보스 로스터 — 층마다 순환(깊이 기반, 무작위 아님). index 0 = 1층 수문장(hp40 고정).
const BOSSES: readonly EnemyBase[] = [
  { id: "warden", name: "심연의 수문장", hp: 40, atk: 8, def: 3, xp: 40, gold: 30, minDepth: 1 }, // prettier-ignore
  { id: "maw", name: "굶주린 아가리", hp: 36, atk: 11, def: 2, xp: 45, gold: 34, minDepth: 1 }, // prettier-ignore
  { id: "colossus", name: "부서진 거상", hp: 52, atk: 7, def: 5, xp: 50, gold: 38, minDepth: 1 }, // prettier-ignore
];

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

// 깊이에 등장 가능한 적(minDepth ≤ depth). 깊이1은 항상 비지 않음.
export function eligibleEnemies(depth: number): readonly EnemyBase[] {
  return ENEMIES.filter((e) => e.minDepth <= depth);
}

// 층 순환으로 고른 보스 베이스(무작위 아님 — 같은 깊이 = 같은 보스).
function bossFor(depth: number): EnemyBase {
  return BOSSES[(depth - 1) % BOSSES.length];
}

export function makeEnemy(
  seed: number,
  depth: number,
  boss: boolean,
): Roll<Enemy> {
  if (boss) return { value: scale(bossFor(depth), depth, true), seed };
  const r = pick(seed, eligibleEnemies(depth));
  return { value: scale(r.value, depth, false), seed: r.seed };
}
