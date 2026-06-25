import { describe, expect, test } from "vitest";
import { newRun, reduce } from "./run";
import { createPlayer } from "./player";
import type { Action, Enemy, RunState } from "./types";

const enemy = (over: Partial<Enemy> = {}): Enemy => ({
  id: "e",
  name: "적",
  hp: 10,
  maxHp: 10,
  atk: 5,
  def: 0,
  xp: 8,
  gold: 5,
  boss: false,
  ...over,
});
const state = (
  over: Partial<RunState> = {},
  e: Enemy | null = enemy(),
): RunState => ({
  seed: 5,
  player: createPlayer(),
  depth: 1,
  step: 1,
  phase: "combat",
  enemy: e,
  shop: [],
  kills: 0,
  log: [],
  ...over,
});

describe("newRun", () => {
  test("초기 상태", () => {
    const s = newRun(42);
    expect(s.depth).toBe(1);
    expect(s.phase).toBe("explore");
    expect(s.player.hp).toBe(30);
    expect(s.enemy).toBeNull();
  });
});

describe("reduce: 전투", () => {
  test("약한 적 처치 → 보상·kills↑·explore 복귀", () => {
    const n = reduce(state({}, enemy({ hp: 3, def: 0 })), { type: "attack" });
    expect(n.enemy).toBeNull();
    expect(n.phase).toBe("explore");
    expect(n.kills).toBe(1);
    expect(n.player.gold).toBe(5);
    expect(n.player.xp).toBe(8);
  });

  test("생존한 적 → 적 반격으로 플레이어 피해", () => {
    const n = reduce(state({}, enemy({ hp: 50, atk: 6, def: 0 })), {
      type: "attack",
    });
    expect(n.phase).toBe("combat");
    expect(n.enemy!.hp).toBeLessThan(50);
    expect(n.player.hp).toBeLessThan(30);
  });

  test("저체력 + 강적 → 반격에 사망", () => {
    const n = reduce(
      state(
        { player: { ...createPlayer(), hp: 1 } },
        enemy({ hp: 50, atk: 9 }),
      ),
      { type: "attack" },
    );
    expect(n.phase).toBe("dead");
    expect(n.player.hp).toBe(0);
  });

  test("보스는 도망 불가", () => {
    const n = reduce(state({}, enemy({ boss: true })), { type: "flee" });
    expect(n.phase).toBe("combat");
    expect(n.enemy).not.toBeNull();
  });

  test("보스 처치 → cleared, descend로 다음 층", () => {
    const after = reduce(state({}, enemy({ hp: 2, boss: true })), {
      type: "attack",
    });
    expect(after.phase).toBe("cleared");
    const down = reduce(after, { type: "descend" });
    expect(down.depth).toBe(2);
    expect(down.phase).toBe("explore");
    expect(down.step).toBe(0);
  });

  test("전투 중 물약 → 회복 + 적 반격", () => {
    const s = state(
      {
        player: {
          ...createPlayer(),
          hp: 5,
          potions: [
            { id: "p", name: "물약", kind: "potion", power: 15, price: 10 },
          ],
        },
      },
      enemy({ hp: 50, atk: 3 }),
    );
    const n = reduce(s, { type: "usePotion" });
    expect(n.player.potions).toHaveLength(0);
    expect(n.player.hp).toBeGreaterThan(5);
    expect(n.phase).toBe("combat");
  });
});

describe("reduce: 진행·상점·가드", () => {
  test("advance는 explore에서만, step 증가", () => {
    const s = newRun(1);
    const n = reduce(s, { type: "advance" });
    expect(n.step).toBe(1);
    expect(n).not.toBe(s);
  });

  test("상점: 구매로 골드 차감·장착, 부족하면 미구매", () => {
    const shop = state({
      phase: "shop",
      shop: [{ id: "w", name: "검", kind: "weapon", power: 6, price: 10 }],
      player: { ...createPlayer(), gold: 20 },
    });
    const n = reduce(shop, { type: "buy", index: 0 });
    expect(n.player.gold).toBe(10);
    expect(n.player.weapon?.power).toBe(6);
    expect(reduce(n, { type: "leaveShop" }).phase).toBe("explore");

    const poor = state({
      phase: "shop",
      shop: [{ id: "w", name: "검", kind: "weapon", power: 6, price: 100 }],
      player: { ...createPlayer(), gold: 5 },
    });
    const m = reduce(poor, { type: "buy", index: 0 });
    expect(m.player.gold).toBe(5);
    expect(m.player.weapon).toBeNull();
  });

  test("사망 후 모든 액션 무시(동일 참조 반환)", () => {
    const dead = state({ phase: "dead" }, null);
    (["advance", "attack", "flee", "usePotion", "descend"] as const).forEach(
      (t) => {
        expect(reduce(dead, { type: t } as Action)).toBe(dead);
      },
    );
  });
});

describe("결정론", () => {
  const autoplay = (seed: number): RunState => {
    let s = newRun(seed);
    for (let i = 0; i < 80 && s.phase !== "dead"; i++) {
      const a: Action =
        s.phase === "explore"
          ? { type: "advance" }
          : s.phase === "combat"
            ? { type: "attack" }
            : s.phase === "cleared"
              ? { type: "descend" }
              : s.phase === "shop"
                ? { type: "leaveShop" }
                : { type: "advance" };
      s = reduce(s, a);
    }
    return s;
  };

  test("같은 시드 + 같은 액션열 → 동일 상태", () => {
    expect(JSON.stringify(autoplay(12345))).toBe(
      JSON.stringify(autoplay(12345)),
    );
  });
});
