import { describe, expect, test } from "vitest";
import {
  attackTiles,
  endTurn,
  moveTiles,
  newGame,
  selectAt,
  selectedUnit,
  waitSelected,
  type UiState,
} from "./controller";
import { reduce } from "@/lib/game/srpg/state";
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
