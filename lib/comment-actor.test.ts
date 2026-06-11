import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";

vi.mock("server-only", () => ({}));

type Mod = typeof import("@/lib/comment-actor");
let m: Mod;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  m = await import("@/lib/comment-actor");
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
