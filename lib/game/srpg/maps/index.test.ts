import { describe, expect, test } from "vitest";
import { MAPS, mapById } from "./index";
import { loadMap } from "../map";
import { TERRAIN } from "../types";

describe("MAPS 레지스트리", () => {
  test("각 맵: loadMap 무throw + 양 진영 유닛 + 스폰 통행 가능", () => {
    for (const m of MAPS) {
      const map = loadMap(m.raw); // 차원/인덱스 오류면 throw → 실패
      const dawn = m.raw.units.filter((u) => u.faction === "dawn");
      const ashen = m.raw.units.filter((u) => u.faction === "ashen");
      expect(dawn.length, `${m.id} dawn`).toBeGreaterThan(0);
      expect(ashen.length, `${m.id} ashen`).toBeGreaterThan(0);
      for (const u of m.raw.units) {
        const terrain = map.tiles[u.row][u.col];
        expect(
          TERRAIN[terrain].passable,
          `${m.id} ${u.faction} ${u.cls} (${u.col},${u.row})=${terrain}`,
        ).toBe(true);
      }
    }
  });

  test("mapById: 알 수 없는 id는 첫 맵으로 폴백", () => {
    expect(mapById("nope").id).toBe(MAPS[0].id);
    expect(mapById(MAPS[1].id).id).toBe(MAPS[1].id);
  });
});
