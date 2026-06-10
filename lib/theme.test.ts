import { describe, expect, test } from "vitest";
import { resolveTheme, THEME_ORDER } from "@/lib/theme";

describe("resolveTheme", () => {
  test("명시적 선택은 그대로", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  test("system은 OS 선호를 따른다", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  test("순환 순서는 light→dark→system", () => {
    expect(THEME_ORDER).toEqual(["light", "dark", "system"]);
  });
});
