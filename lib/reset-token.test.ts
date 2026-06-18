// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

let store: Map<string, string>;
let deleted: string[];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => {
      const v = store.get(k);
      return v ? { value: v } : undefined;
    },
    set: (k: string, v: string) => store.set(k, v),
    delete: (k: string) => {
      deleted.push(k);
      store.delete(k);
    },
  }),
}));

import {
  setResetCookie,
  getResetCookie,
  clearResetCookie,
} from "@/lib/reset-token";

const data = {
  email: "a@x.com",
  expiresAt: "2030-01-01T00:00:00.000Z",
  verified: false,
};

beforeEach(() => {
  store = new Map();
  deleted = [];
});

describe("reset-token", () => {
  test("set→get 라운드트립(pwreset 쿠키)", async () => {
    await setResetCookie(data);
    expect(store.has("pwreset")).toBe(true);
    expect(await getResetCookie()).toMatchObject(data);
  });

  test("verified=true 보존", async () => {
    await setResetCookie({ ...data, verified: true });
    expect((await getResetCookie())?.verified).toBe(true);
  });

  test("쿠키 없음 → undefined", async () => {
    expect(await getResetCookie()).toBeUndefined();
  });

  test("변조 토큰 → undefined", async () => {
    await setResetCookie(data);
    store.set("pwreset", store.get("pwreset")!.slice(0, -3) + "zzz");
    expect(await getResetCookie()).toBeUndefined();
  });

  test("clearResetCookie: 삭제", async () => {
    await setResetCookie(data);
    await clearResetCookie();
    expect(deleted).toContain("pwreset");
  });
});
