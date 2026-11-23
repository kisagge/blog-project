import { describe, expect, test } from "vitest";
import { safeEqual } from "@/lib/safe-equal";

describe("safeEqual", () => {
  test("같으면 true, 다르거나 길이가 다르면 false", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secret", "secreT")).toBe(false);
    expect(safeEqual("secret", "secret!")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
  test("멀티바이트도 바이트 단위로 비교", () => {
    expect(safeEqual("비밀", "비밀")).toBe(true);
    expect(safeEqual("비밀", "비빌")).toBe(false);
  });
});
