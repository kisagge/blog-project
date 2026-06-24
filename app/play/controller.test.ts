import { describe, expect, test } from "vitest";
import {
  attackTiles,
  endTurn,
  moveTiles,
  newGame,
  previewAttack,
  previewText,
  selectAt,
  selectedUnit,
  waitSelected,
  type UiState,
} from "./controller";
import { createGame, reduce } from "@/lib/game/srpg/state";
import type { RawMap } from "@/lib/game/srpg/map";

// 1행 평지 맵 빌더(정밀 위치 제어).
const line = (units: RawMap["units"], cols = 5): RawMap => ({
  id: "t",
  name: "t",
  cols,
  rows: 1,
  tiles: [Array(cols).fill(0)],
  units,
});
const W_far = () =>
  line([
    { faction: "dawn", cls: "warrior", col: 0, row: 0 },
    { faction: "ashen", cls: "warrior", col: 4, row: 0 },
  ]);
const unit = (ui: UiState, id: string) =>
  ui.game.units.find((u) => u.id === id)!;

describe("selectAt", () => {
  test("아군 선택 → 선택됨 + 이동범위 노출", () => {
    const s = selectAt(newGame(W_far()), { col: 0, row: 0 });
    expect(s.ui.selectedId).toBe("dawn-0");
    expect(moveTiles(s.ui).length).toBeGreaterThan(0);
    expect(s.announce).toContain("선택");
  });

  test("선택 없이 적/빈 칸 클릭 → 무변화", () => {
    const ui = newGame(W_far());
    expect(selectAt(ui, { col: 4, row: 0 }).ui.selectedId).toBeNull();
    expect(selectAt(ui, { col: 2, row: 0 }).ui.selectedId).toBeNull();
  });

  test("이동 → moved + 선택 유지, 이동범위 사라짐", () => {
    let ui = newGame(W_far());
    ui = selectAt(ui, { col: 0, row: 0 }).ui;
    const s = selectAt(ui, { col: 2, row: 0 });
    expect(s.ui.selectedId).toBe("dawn-0");
    expect(selectedUnit(s.ui)!.col).toBe(2);
    expect(selectedUnit(s.ui)!.moved).toBe(true);
    expect(moveTiles(s.ui)).toHaveLength(0);
    expect(s.announce).toContain("이동");
  });

  test("인접 적 공격 → 피해 + 반격 + 선택 해제", () => {
    let ui = newGame(
      line([
        { faction: "dawn", cls: "warrior", col: 0, row: 0 },
        { faction: "ashen", cls: "warrior", col: 1, row: 0 },
      ]),
    );
    ui = selectAt(ui, { col: 0, row: 0 }).ui;
    const s = selectAt(ui, { col: 1, row: 0 });
    expect(unit(s.ui, "ashen-0").hp).toBe(24); // 28 - 4
    expect(unit(s.ui, "dawn-0").hp).toBe(24); // 반격 4
    expect(s.ui.selectedId).toBeNull();
    expect(s.announce).toContain("피해");
  });

  test("선택 상태에서 다른 아군 클릭 → 선택 전환", () => {
    let ui = newGame(
      line([
        { faction: "dawn", cls: "warrior", col: 0, row: 0 },
        { faction: "dawn", cls: "archer", col: 1, row: 0 },
        { faction: "ashen", cls: "warrior", col: 4, row: 0 },
      ]),
    );
    ui = selectAt(ui, { col: 0, row: 0 }).ui;
    const s = selectAt(ui, { col: 1, row: 0 });
    expect(s.ui.selectedId).toBe("dawn-1");
  });
});

describe("waitSelected / endTurn", () => {
  test("대기 → acted + 해제", () => {
    let ui = newGame(W_far());
    ui = selectAt(ui, { col: 0, row: 0 }).ui;
    const s = waitSelected(ui);
    expect(unit(s.ui, "dawn-0").acted).toBe(true);
    expect(s.ui.selectedId).toBeNull();
  });

  test("endTurn → 적 AI 페이즈 후 dawn·라운드2(결정론)", () => {
    const ui = newGame(); // SKIRMISH_01
    const a = endTurn(ui);
    const b = endTurn(ui);
    expect(JSON.stringify(a.ui.game)).toBe(JSON.stringify(b.ui.game));
    expect(a.ui.game.phase).toBe("dawn");
    expect(a.ui.game.round).toBe(2);
    expect(a.ui.selectedId).toBeNull();
  });
});

describe("previewAttack / previewText", () => {
  test("인접 전사 vs 전사: 피해 4 + 반격 4", () => {
    const g = createGame(
      line([
        { faction: "dawn", cls: "warrior", col: 0, row: 0 },
        { faction: "ashen", cls: "warrior", col: 1, row: 0 },
      ]),
    );
    const p = previewAttack(g, "dawn-0", { col: 1, row: 0 });
    expect(p).toEqual({ dmg: 4, lethal: false, counter: 4 });
    const t = previewText(g, "dawn-0", { col: 1, row: 0 })!;
    expect(t).toContain("4 피해");
    expect(t).toContain("반격 4");
  });

  test("궁수 2칸: 반격 없음", () => {
    const g = createGame(
      line([
        { faction: "dawn", cls: "archer", col: 0, row: 0 },
        { faction: "ashen", cls: "warrior", col: 2, row: 0 },
      ]),
    );
    const p = previewAttack(g, "dawn-0", { col: 2, row: 0 })!;
    expect(p.dmg).toBe(3);
    expect(p.counter).toBe(0);
    expect(previewText(g, "dawn-0", { col: 2, row: 0 })).not.toContain("반격");
  });

  test("적 없는 칸/사거리 밖 → null", () => {
    const g = createGame(
      line([
        { faction: "dawn", cls: "warrior", col: 0, row: 0 },
        { faction: "ashen", cls: "warrior", col: 3, row: 0 },
      ]),
    );
    expect(previewAttack(g, "dawn-0", { col: 1, row: 0 })).toBeNull(); // 빈 칸
    expect(previewAttack(g, "dawn-0", { col: 3, row: 0 })).toBeNull(); // 사거리 밖
  });

  test("사전 피해 후 마무리 일격 → lethal", () => {
    let g = createGame(
      line(
        [
          { faction: "dawn", cls: "warrior", col: 0, row: 0 },
          { faction: "dawn", cls: "warrior", col: 2, row: 0 },
          { faction: "ashen", cls: "mage", col: 1, row: 0 },
        ],
        3,
      ),
    );
    g = reduce(g, {
      type: "attack",
      unitId: "dawn-0",
      target: { col: 1, row: 0 },
    }); // mage 16→8
    const p = previewAttack(g, "dawn-1", { col: 1, row: 0 })!;
    expect(p.lethal).toBe(true); // physical(9,1,0)=8 ≥ 8
    expect(p.counter).toBe(0); // 죽으면 반격 없음
  });
});

describe("가드", () => {
  test("내 페이즈 아니면 입력 무시", () => {
    const base = newGame(W_far());
    const ashenUi = {
      game: reduce(base.game, { type: "endPhase" }),
      selectedId: null,
    };
    expect(selectAt(ashenUi, { col: 0, row: 0 }).ui.selectedId).toBeNull();
    expect(endTurn(ashenUi).ui.game.phase).toBe("ashen"); // 무변화
    expect(attackTiles(ashenUi)).toHaveLength(0);
  });
});
