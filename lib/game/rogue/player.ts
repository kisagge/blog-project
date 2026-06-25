// 플레이어 스탯·성장·장비·소비(순수). 레벨업·회복·획득 계산.
import {
  BASE_PLAYER,
  armorPower,
  weaponPower,
  type Item,
  type Player,
} from "./types";

export function createPlayer(): Player {
  return { ...BASE_PLAYER, weapon: null, armor: null, potions: [] };
}

// 현재 레벨에서 다음 레벨로 가는 데 필요한 xp.
export function xpForLevel(level: number): number {
  return level * 20;
}

// xp 획득 → 가능한 만큼 레벨업(스탯↑ + 레벨업 시 전체 회복).
export function gainXp(
  p: Player,
  amount: number,
): { player: Player; leveled: number } {
  let xp = p.xp + amount;
  let { level, maxHp, atk, def } = p;
  let leveled = 0;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    maxHp += 6;
    atk += 2;
    def += 1;
    leveled += 1;
  }
  return {
    player: {
      ...p,
      xp,
      level,
      maxHp,
      atk,
      def,
      hp: leveled > 0 ? maxHp : p.hp,
    },
    leveled,
  };
}

export function heal(p: Player, amount: number): Player {
  return { ...p, hp: Math.min(p.maxHp, p.hp + amount) };
}
export function damage(p: Player, amount: number): Player {
  return { ...p, hp: Math.max(0, p.hp - amount) };
}
export function addGold(p: Player, amount: number): Player {
  return { ...p, gold: Math.max(0, p.gold + amount) };
}

// 아이템 획득: 물약→인벤토리, 무기/방어구→더 좋으면 장착·아니면 절반값 매각.
export function acquire(
  p: Player,
  item: Item,
): { player: Player; equipped: boolean } {
  if (item.kind === "potion") {
    return { player: { ...p, potions: [...p.potions, item] }, equipped: false };
  }
  const cur = item.kind === "weapon" ? weaponPower(p) : armorPower(p);
  if (item.power > cur) {
    const player =
      item.kind === "weapon" ? { ...p, weapon: item } : { ...p, armor: item };
    return { player, equipped: true };
  }
  return { player: addGold(p, Math.floor(item.price / 2)), equipped: false };
}

// 물약 1개 사용 → 회복. 없으면 null. (이름은 use* 접두를 피해 React Hook 오탐 회피.)
export function consumePotion(
  p: Player,
): { player: Player; healed: number } | null {
  if (p.potions.length === 0) return null;
  const [potion, ...rest] = p.potions;
  const before = p.hp;
  const player = heal({ ...p, potions: rest }, potion.power);
  return { player, healed: player.hp - before };
}
