import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Users = typeof import("@/lib/users");
let m: Users;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  m = await import("@/lib/users");
});
afterAll(async () => {
  await cleanup();
});

describe("users", () => {
  test("가입은 pending 회원을 만든다", async () => {
    const r = await m.createPendingUser({
      email: "A@x.com",
      nickname: "에이",
      password: "password1",
    });
    expect(r.ok).toBe(true);
    const u = await m.findUserByEmail("a@x.com"); // 소문자 정규화 확인
    expect(u?.status).toBe("pending");
  });
  test("중복 이메일은 거부", async () => {
    const r = await m.createPendingUser({
      email: "a@x.com",
      nickname: "또",
      password: "password1",
    });
    expect(r).toEqual({ ok: false, error: "이미 가입된 이메일입니다." });
  });
  test("미승인 회원은 로그인 차단", async () => {
    const r = await m.authenticateMember("a@x.com", "password1");
    expect(r).toEqual({ ok: false, error: "관리자 승인 대기 중입니다." });
  });
  test("승인 후 올바른 비밀번호로 로그인 성공", async () => {
    const u = await m.findUserByEmail("a@x.com");
    await m.approveUser(u!.id);
    const r = await m.authenticateMember("a@x.com", "password1");
    expect(r.ok).toBe(true);
  });
  test("틀린 비밀번호는 일반 메시지로 실패", async () => {
    const r = await m.authenticateMember("a@x.com", "nope");
    expect(r).toEqual({
      ok: false,
      error: "이메일 또는 비밀번호가 올바르지 않습니다.",
    });
  });

  test("countUsersByStatus: 승인 1, 대기 0 (앞 테스트에서 승인됨)", async () => {
    expect(await m.countUsersByStatus("approved")).toBe(1);
    expect(await m.countUsersByStatus("pending")).toBe(0);
  });
});
