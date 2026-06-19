// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { sniffImageType, deleteUpload } from "@/lib/save-image";

// 1×1 투명 PNG.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP", "ascii"),
]);

describe("sniffImageType", () => {
  test("PNG·JPEG·WEBP 시그니처를 각 타입으로 판별", () => {
    expect(sniffImageType(PNG_1x1)).toBe("png");
    expect(sniffImageType(JPEG)).toBe("jpg");
    expect(sniffImageType(WEBP)).toBe("webp");
  });

  test("비이미지·짧은 버퍼는 null(MIME 위장 차단)", () => {
    expect(sniffImageType(Buffer.from("이건 이미지가 아님"))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull(); // 너무 짧음
    // RIFF지만 WEBP 아님(wav 등) → null
    const riffWav = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WAVE", "ascii"),
    ]);
    expect(sniffImageType(riffWav)).toBeNull();
  });
});

describe("deleteUpload", () => {
  test("비-uploads·외부 URL은 no-op(throw 없음)", async () => {
    await expect(
      deleteUpload("https://evil.com/a.png"),
    ).resolves.toBeUndefined();
    await expect(deleteUpload("/etc/passwd")).resolves.toBeUndefined();
    await expect(
      deleteUpload("/uploads/../secret.png"),
    ).resolves.toBeUndefined();
  });

  test("형식은 맞지만 미존재 파일도 throw 없이 resolve", async () => {
    await expect(
      deleteUpload("/uploads/00000000-0000-0000-0000-000000000000.png"),
    ).resolves.toBeUndefined();
  });
});
