import { describe, expect, test } from "vitest";
import { normalizeTheme, THEME_ORDER, DEFAULT_THEME } from "@/lib/theme";

describe("theme", () => {
  test("순환 순서는 대표→라이트→다크", () => {
    expect(THEME_ORDER).toEqual(["brand", "light", "dark"]);
  });
  test("기본 테마는 대표(brand)", () => {
    expect(DEFAULT_THEME).toBe("brand");
  });
  test("유효한 저장값은 그대로", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("brand")).toBe("brand");
  });
  test("무효값(구버전 system·null)은 기본 대표로", () => {
    expect(normalizeTheme("system")).toBe("brand");
    expect(normalizeTheme(null)).toBe("brand");
    expect(normalizeTheme("xyz")).toBe("brand");
  });
});
