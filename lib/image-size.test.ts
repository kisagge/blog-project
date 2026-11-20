// @vitest-environment node
import { describe, expect, test } from "vitest";

import { imageDimensions } from "@/lib/image-size";
import { PNG_1x1 } from "@/test/helpers";

describe("imageDimensions", () => {
  test("PNG 버퍼에서 픽셀 치수를 읽는다", () => {
    expect(imageDimensions(PNG_1x1)).toEqual({ width: 1, height: 1 });
  });

  test("손상/미지원 버퍼는 null(업로드 차단 안 함)", () => {
    expect(imageDimensions(Buffer.from("이건 이미지가 아님"))).toBeNull();
  });
});
