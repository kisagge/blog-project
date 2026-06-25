// 로그라이크 텍스트 RPG(심연 강하) 순수 도메인 타입 + 상수. DOM/DB/three 의존 0.
// 설계: docs/games/text-rpg-design.md. 시드 결정론(모든 무작위는 seed 전진)·불변 업데이트가 원칙.

export type ItemKind = "weapon" | "armor" | "potion";
export type Item = {
  id: string;
  name: string;
  kind: ItemKind;
  power: number; // 무기=ATK, 방어구=DEF, 물약=회복량
  price: number; // 상점가
};

export type Player = {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  gold: number;
  level: number;
  xp: number;
  weapon: Item | null;
  armor: Item | null;
  potions: Item[];
};

export type Enemy = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  xp: number; // 처치 보상
  gold: number;
  boss: boolean;
};

export type EventKind =
  | "combat"
  | "treasure"
  | "shop"
  | "rest"
  | "trap"
  | "boss";

// 게임 진행 단계.
export type Phase =
  | "explore" // 다음 걸음 대기
  | "combat" // 전투 중
  | "shop" // 상점
  | "cleared" // 보스 처치, 하강 대기
  | "dead"; // 영구사망(종료)

export type RunState = {
  seed: number; // 현재 PRNG 시드(매 무작위마다 전진)
  player: Player;
  depth: number; // 현재 층(1부터)
  step: number; // 현재 층에서 지난 걸음 수(0..STEPS_PER_FLOOR)
  phase: Phase;
  enemy: Enemy | null; // 전투 중 적
  shop: Item[]; // 상점 재고(phase=shop)
  kills: number;
  log: string[]; // 시간순 로그
};

export type Action =
  | { type: "advance" } // 다음 걸음(이벤트 해결)
  | { type: "attack" }
  | { type: "flee" }
  | { type: "usePotion" }
  | { type: "buy"; index: number } // 상점 구매
  | { type: "leaveShop" }
  | { type: "descend" }; // 보스 처치 후 다음 층

// ── 상수(밸런스는 살아있는 값 — 플레이테스트로 조정) ──

export const BASE_PLAYER: Omit<Player, "weapon" | "armor" | "potions"> = {
  hp: 30,
  maxHp: 30,
  atk: 6,
  def: 2,
  gold: 0,
  level: 1,
  xp: 0,
};

export const STEPS_PER_FLOOR = 5; // 1..4 무작위 이벤트, 5 = 보스
export const CRIT_CHANCE = 0.15; // 플레이어 치명타 확률
export const FLEE_CHANCE = 0.5; // 도망 성공 확률(보스 제외)

// 점수 가중(score.ts).
export const SCORE = { perDepth: 100, perKill: 25 } as const;

export function weaponPower(p: Player): number {
  return p.weapon?.power ?? 0;
}
export function armorPower(p: Player): number {
  return p.armor?.power ?? 0;
}
export function effectiveAtk(p: Player): number {
  return p.atk + weaponPower(p);
}
export function effectiveDef(p: Player): number {
  return p.def + armorPower(p);
}
