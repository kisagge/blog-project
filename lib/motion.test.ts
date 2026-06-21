import { afterEach, describe, expect, test, vi } from "vitest";
import { prefersReducedMotion } from "@/lib/motion";

const origMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = origMatchMedia;
});

describe("prefersReducedMotion", () => {
  test("matchMedia matches=true면 true", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    expect(prefersReducedMotion()).toBe(true);
  });

  test("matchMedia matches=false면 false", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    expect(prefersReducedMotion()).toBe(false);
  });

  test("matchMedia 미지원이면 false(SSR 안전)", () => {
    // @ts-expect-error 테스트용 제거
    window.matchMedia = undefined;
    expect(prefersReducedMotion()).toBe(false);
  });
});
