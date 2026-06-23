import { describe, expect, test, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

let xff: string | null = null;
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (k: string) => (k === "x-forwarded-for" ? xff : null),
  }),
}));

import { getClientIp } from "@/lib/client-ip";

beforeEach(() => {
  xff = null;
});

describe("getClientIp", () => {
  test("단일 IP", async () => {
    xff = "1.2.3.4";
    expect(await getClientIp()).toBe("1.2.3.4");
  });
  test("다중(a, b) → 첫 항목 trim", async () => {
    xff = " 1.1.1.1 , 2.2.2.2";
    expect(await getClientIp()).toBe("1.1.1.1");
  });
  test("헤더 없음 → undefined", async () => {
    xff = null;
    expect(await getClientIp()).toBeUndefined();
  });
  test("빈 문자열 → undefined", async () => {
    xff = "";
    expect(await getClientIp()).toBeUndefined();
  });
});
