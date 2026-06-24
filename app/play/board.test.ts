import { describe, expect, test } from "vitest";
import { tileVisual, worldPos } from "./board";
import { loadMap } from "@/lib/game/srpg/map";
import { SKIRMISH_01 } from "@/lib/game/srpg/maps/skirmish-01";

describe("tileVisual", () => {
  test("지형별 색·높이 구분", () => {
    const plain = tileVisual("plain");
    const water = tileVisual("water");
    const wall = tileVisual("wall");
    // 벽이 가장 높고, 물은 평지보다 낮다.
    expect(wall.height).toBeGreaterThan(plain.height);
    expect(water.height).toBeLessThan(plain.height);
    // 색이 지형마다 다르다.
    const colors = (["plain", "forest", "hill", "water", "wall"] as const).map(
      (t) => tileVisual(t).color,
    );
    expect(new Set(colors).size).toBe(5);
  });
});

describe("worldPos", () => {
  const map = loadMap(SKIRMISH_01); // 8×10

  test("보드를 원점 중심으로 정렬", () => {
    // 좌상단·우하단이 원점 대칭.
    const tl = worldPos({ col: 0, row: 0 }, map);
    const br = worldPos({ col: 7, row: 9 }, map);
    expect(tl.x).toBeCloseTo(-br.x);
    expect(tl.z).toBeCloseTo(-br.z);
    expect(tl.x).toBeCloseTo(-3.5);
    expect(tl.z).toBeCloseTo(-4.5);
  });

  test("col→x, row→z 증가", () => {
    expect(worldPos({ col: 1, row: 0 }, map).x).toBeGreaterThan(
      worldPos({ col: 0, row: 0 }, map).x,
    );
    expect(worldPos({ col: 0, row: 1 }, map).z).toBeGreaterThan(
      worldPos({ col: 0, row: 0 }, map).z,
    );
  });
});
