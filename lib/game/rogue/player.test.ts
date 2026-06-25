import { describe, expect, test } from "vitest";
import {
  acquire,
  createPlayer,
  damage,
  gainXp,
  heal,
  consumePotion,
  xpForLevel,
} from "./player";
import type { Item } from "./types";

const weapon = (power: number): Item => ({
  id: "w",
  name: "검",
  kind: "weapon",
  power,
  price: 30,
});
const potion = (power: number): Item => ({
  id: "p",
  name: "물약",
  kind: "potion",
  power,
  price: 10,
});

describe("player", () => {
  test("createPlayer 기본값", () => {
    const p = createPlayer();
    expect(p.hp).toBe(30);
    expect(p.level).toBe(1);
    expect(p.weapon).toBeNull();
    expect(p.potions).toHaveLength(0);
  });

  test("gainXp: 정확히 1레벨 → 스탯↑ + 전체 회복", () => {
    const p = { ...createPlayer(), hp: 10 };
    const r = gainXp(p, xpForLevel(1)); // 20
    expect(r.leveled).toBe(1);
    expect(r.player.level).toBe(2);
    expect(r.player.maxHp).toBe(36);
    expect(r.player.hp).toBe(36); // 회복
    expect(r.player.atk).toBe(8);
    expect(r.player.def).toBe(3);
  });

  test("gainXp: 다중 레벨업", () => {
    const big = xpForLevel(1) + xpForLevel(2) + xpForLevel(3);
    expect(gainXp(createPlayer(), big).leveled).toBe(3);
  });

  test("heal/damage 클램프", () => {
    const p = { ...createPlayer(), hp: 5 };
    expect(heal(p, 100).hp).toBe(30);
    expect(damage(p, 100).hp).toBe(0);
  });

  test("acquire: 더 좋으면 장착, 약하면 매각, 물약은 인벤토리", () => {
    let p = createPlayer();
    p = acquire(p, weapon(6)).player;
    expect(p.weapon?.power).toBe(6);
    const worse = acquire(p, weapon(3));
    expect(worse.equipped).toBe(false);
    expect(worse.player.gold).toBe(15); // floor(30/2)
    const pot = acquire(p, potion(15));
    expect(pot.player.potions).toHaveLength(1);
  });

  test("consumePotion: 회복·소모, 없으면 null", () => {
    const p = { ...createPlayer(), hp: 10, potions: [potion(15)] };
    const u = consumePotion(p)!;
    expect(u.player.hp).toBe(25);
    expect(u.player.potions).toHaveLength(0);
    expect(u.healed).toBe(15);
    expect(consumePotion(createPlayer())).toBeNull();
  });
});
