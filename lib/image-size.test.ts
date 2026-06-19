// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { imageDimensions } from "@/lib/image-size";

// 1×1 투명 PNG.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

describe("imageDimensions", () => {
  test("PNG 버퍼에서 픽셀 치수를 읽는다", () => {
    expect(imageDimensions(PNG_1x1)).toEqual({ width: 1, height: 1 });
  });

  test("손상/미지원 버퍼는 null(업로드 차단 안 함)", () => {
    expect(imageDimensions(Buffer.from("이건 이미지가 아님"))).toBeNull();
  });
});
