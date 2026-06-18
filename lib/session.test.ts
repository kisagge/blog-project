// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

// 옵션까지 캡처하는 인메모리 쿠키 저장소.
let store: Map<string, { value: string; options?: Record<string, unknown> }>;
let deleted: string[];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => {
      const e = store.get(k);
      return e ? { value: e.value } : undefined;
    },
    set: (k: string, v: string, options?: Record<string, unknown>) =>
      store.set(k, { value: v, options }),
    delete: (k: string) => {
      deleted.push(k);
      store.delete(k);
    },
  }),
}));

import {
  createAdminSession,
  createMemberSession,
  deleteSession,
} from "@/lib/session";
import { decrypt } from "@/lib/jwt";

beforeEach(() => {
  store = new Map();
  deleted = [];
});

describe("session", () => {
  test("createMemberSession: session 쿠키 + 보안 옵션 + 복호화 페이로드", async () => {
    await createMemberSession("u1", "닉네임");
    const entry = store.get("session");
    expect(entry).toBeDefined();
    expect(entry!.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    expect(await decrypt(entry!.value)).toMatchObject({
      role: "member",
      userId: "u1",
      nickname: "닉네임",
    });
  });

  test("createAdminSession: role admin", async () => {
    await createAdminSession();
    expect((await decrypt(store.get("session")!.value))?.role).toBe("admin");
  });

  test("deleteSession: session 쿠키 삭제", async () => {
    await createAdminSession();
    await deleteSession();
    expect(deleted).toContain("session");
    expect(store.has("session")).toBe(false);
  });
});
