import { describe, expect, test } from "vitest";
import { createUnits, loadMap, type RawMap } from "./map";
import { SKIRMISH_01 } from "./maps/skirmish-01";

describe("map loader", () => {
  test("loadMap: enum→Terrain 변환", () => {
    const raw: RawMap = {
      id: "x",
      name: "x",
      cols: 2,
      rows: 2,
      tiles: [
        [0, 1],
        [3, 4],
      ],
      units: [],
    };
    const m = loadMap(raw);
    expect(m.tiles[0][0]).toBe("plain");
    expect(m.tiles[0][1]).toBe("forest");
    expect(m.tiles[1][0]).toBe("water");
    expect(m.tiles[1][1]).toBe("wall");
  });

  test("loadMap: 행/열 불일치 throw", () => {
    expect(() =>
      loadMap({
        id: "x",
        name: "x",
        cols: 2,
        rows: 2,
        tiles: [[0, 1]],
        units: [],
      }),
    ).toThrow();
    expect(() =>
      loadMap({
        id: "x",
        name: "x",
        cols: 2,
        rows: 1,
        tiles: [[0]],
        units: [],
      }),
    ).toThrow();
  });

  test("loadMap: 잘못된 지형 인덱스 throw", () => {
    expect(() =>
      loadMap({
        id: "x",
        name: "x",
        cols: 1,
        rows: 1,
        tiles: [[9]],
        units: [],
      }),
    ).toThrow();
  });

  test("createUnits: id 부여 + hp=maxHp", () => {
    const us = createUnits({
      id: "x",
      name: "x",
      cols: 3,
      rows: 1,
      tiles: [[0, 0, 0]],
      units: [
        { faction: "dawn", cls: "warrior", col: 0, row: 0 },
        { faction: "ashen", cls: "mage", col: 2, row: 0 },
      ],
    });
    expect(us[0].id).toBe("dawn-0");
    expect(us[0].hp).toBe(28);
    expect(us[1].id).toBe("ashen-0");
    expect(us[1].hp).toBe(16);
  });

  test("샘플 맵 차원·유닛 수", () => {
    const m = loadMap(SKIRMISH_01);
    expect(m.cols).toBe(8);
    expect(m.rows).toBe(10);
    const us = createUnits(SKIRMISH_01);
    expect(us.filter((u) => u.faction === "dawn")).toHaveLength(4);
    expect(us.filter((u) => u.faction === "ashen")).toHaveLength(5);
  });
});
