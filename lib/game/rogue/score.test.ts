import { describe, expect, test } from "vitest";
import { computeScore } from "./score";
import { newRun } from "./run";

describe("score", () => {
  test("depth·kills·gold 가중", () => {
    const base = newRun(1);
    const s = {
      ...base,
      depth: 3,
      kills: 4,
      player: { ...base.player, gold: 50 },
    };
    expect(computeScore(s)).toBe(3 * 100 + 4 * 25 + 50); // 450
  });
});
