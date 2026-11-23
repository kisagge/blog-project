import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Mod = typeof import("@/lib/admin-user");
let m: Mod;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  m = await import("@/lib/admin-user");
});
afterAll(async () => {
  await cleanup();
});

describe("admin user / nickname", () => {
  test("ensureAdminUser는 예약 User를 1회 생성(멱등)", async () => {
    const a = await m.ensureAdminUser();
    const b = await m.ensureAdminUser();
    expect(a.id).toBe(b.id);
    expect(a.email).toBe("admin@byjang.local");
  });
  test("기본 닉네임은 관리자, setAdminNickname로 변경", async () => {
    expect(await m.getAdminNickname()).toBe("관리자");
    await m.setAdminNickname("운영자");
    expect(await m.getAdminNickname()).toBe("운영자");
  });
});

describe("예약 관리자 이메일 선점 방지", () => {
  test("같은 이메일의 기존 행이 있어도 ensureAdminUser는 로그인 불가 해시·승인 상태로 고정", async () => {
    const prisma = (await import("@/lib/prisma")).prisma;
    await prisma.user.deleteMany({ where: { email: "admin@byjang.local" } });
    await prisma.user.create({
      data: {
        email: "admin@byjang.local",
        nickname: "선점자",
        passwordHash: "salt:hash",
        status: "pending",
      },
    });
    const a = await m.ensureAdminUser();
    expect(a.role).toBe("admin");
    expect(a.passwordHash).toBe("-");
    expect(a.status).toBe("approved");
  });
});
