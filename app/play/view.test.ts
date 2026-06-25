import { describe, expect, test } from "vitest";
import { newRun } from "@/lib/game/rogue/run";
import type { Enemy, Item, RunState } from "@/lib/game/rogue/types";
import { actionsFor, hudView } from "./view";

const potion: Item = {
  id: "p",
  name: "물약",
  kind: "potion",
  power: 15,
  price: 10,
};
const enemy: Enemy = {
  id: "e",
  name: "고블린",
  hp: 6,
  maxHp: 12,
  atk: 4,
  def: 1,
  xp: 5,
  gold: 3,
  boss: false,
};

function withPhase(over: Partial<RunState>): RunState {
  return { ...newRun(1), ...over };
}

describe("hudView", () => {
  test("새 런 요약", () => {
    const h = hudView(newRun(1));
    expect(h.depth).toBe(1);
    expect(h.phase).toBe("explore");
    expect(h.phaseLabel).toBe("탐험");
    expect(h.hp).toBe(30);
    expect(h.maxHp).toBe(30);
    expect(h.hpPct).toBe(100);
    expect(h.weapon).toBe("맨손");
    expect(h.armor).toBe("평상복");
    expect(h.score).toBe(100); // depth*100 + 0 kills + 0 gold
    expect(h.enemy).toBeNull();
  });

  test("전투 중 적 HP 비율", () => {
    const h = hudView(withPhase({ phase: "combat", enemy }));
    expect(h.enemy).toEqual({
      name: "고블린",
      hp: 6,
      maxHp: 12,
      hpPct: 50,
    });
  });
});

describe("actionsFor", () => {
  test("탐험: 전진(기본), 물약 있으면 추가", () => {
    const base = actionsFor(newRun(1));
    expect(base.map((b) => b.label)).toEqual(["전진"]);
    expect(base[0].primary).toBe(true);

    const p = newRun(1);
    p.player.potions.push(potion);
    expect(actionsFor(p).map((b) => b.label)).toEqual(["전진", "물약 사용"]);
  });

  test("전투: 공격(기본)·도망, 물약은 보유 시", () => {
    const a = actionsFor(withPhase({ phase: "combat", enemy }));
    expect(a.map((b) => b.label)).toEqual(["공격", "도망"]);
    expect(a.find((b) => b.primary)?.label).toBe("공격");

    const s = withPhase({ phase: "combat", enemy });
    s.player.potions.push(potion);
    expect(actionsFor(s).map((b) => b.label)).toContain("물약 사용");
  });

  test("상점: 재고 구매 + 나가기(기본), 단축키 순차", () => {
    const shop: Item[] = [
      { id: "w", name: "검", kind: "weapon", power: 3, price: 20 },
      potion,
    ];
    const a = actionsFor(withPhase({ phase: "shop", shop }));
    expect(a.map((b) => b.key)).toEqual(["1", "2", "3"]);
    expect(a[0].action).toEqual({ type: "buy", index: 0 });
    expect(a[1].action).toEqual({ type: "buy", index: 1 });
    expect(a[2].label).toBe("상점 나가기");
    expect(a[2].primary).toBe(true);
  });

  test("클리어: 내려가기 / 사망: 빈 목록", () => {
    expect(
      actionsFor(withPhase({ phase: "cleared" })).map((b) => b.label),
    ).toEqual(["더 깊이 내려가기"]);
    expect(actionsFor(withPhase({ phase: "dead" }))).toEqual([]);
  });
});
