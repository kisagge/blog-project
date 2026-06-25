// 전투 데미지 계산(순수·결정론). max(1, atk−def) + 소량 변동, 선택적 치명타.
import { chance, randInt } from "./rng";
import { CRIT_CHANCE } from "./types";

export type AttackResult = { dmg: number; crit: boolean; seed: number };

export function attackRoll(
  seed: number,
  atk: number,
  def: number,
  canCrit: boolean,
): AttackResult {
  const v = randInt(seed, -1, 1); // ±1 변동
  let dmg = Math.max(1, atk - def + v.value);
  let crit = false;
  let s = v.seed;
  if (canCrit) {
    const c = chance(s, CRIT_CHANCE);
    crit = c.value;
    s = c.seed;
    if (crit) dmg = dmg * 2;
  }
  return { dmg: Math.max(1, dmg), crit, seed: s };
}
