import { describe, test, expect } from "vitest";
import { checkImage, MAX_IMAGE_BYTES } from "@/lib/upload";

describe("checkImage", () => {
  test("png/jpeg/webp는 통과하고 확장자를 준다", () => {
    expect(checkImage("image/png", 1000)).toEqual({ ok: true, ext: "png" });
    expect(checkImage("image/jpeg", 1000)).toEqual({ ok: true, ext: "jpg" });
    expect(checkImage("image/webp", 1000)).toEqual({ ok: true, ext: "webp" });
  });
  test("gif 등 허용되지 않은 형식은 거부", () => {
    const r = checkImage("image/gif", 1000);
    expect(r.ok).toBe(false);
  });
  test("5MB 초과는 거부", () => {
    const r = checkImage("image/png", MAX_IMAGE_BYTES + 1);
    expect(r.ok).toBe(false);
  });
  test("경계값(정확히 5MB)은 통과", () => {
    expect(checkImage("image/png", MAX_IMAGE_BYTES).ok).toBe(true);
  });
});
