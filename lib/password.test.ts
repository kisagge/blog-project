import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  test("해시 후 같은 비밀번호로 검증 성공", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });
  test("틀린 비밀번호는 검증 실패", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });
  test("같은 비밀번호도 매번 다른 해시(salt)", async () => {
    expect(await hashPassword("x")).not.toBe(await hashPassword("x"));
  });
  test("형식이 깨진 저장값은 false", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});
