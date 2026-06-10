import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { setupTestDb } from "@/lib/test-db";

// site-config/dal은 "server-only"를 import 하는데, 테스트(non-server) 환경에선 throw하므로 no-op 처리.
vi.mock("server-only", () => ({}));

type SiteConfig = typeof import("@/lib/site-config");
let getPublicEnabled: SiteConfig["getPublicEnabled"];
let setPublicEnabled: SiteConfig["setPublicEnabled"];
let prisma: PrismaClient;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  ({ getPublicEnabled, setPublicEnabled } = await import("@/lib/site-config"));
});

afterAll(async () => {
  await cleanup();
});

describe("site-config", () => {
  // getPublicEnabled는 react cache라 set 이후 값이 갱신되지 않으므로,
  // "row 없을 때 기본 true"는 set보다 먼저 1회만 검증한다.
  test("설정 row가 없으면 기본 공개(true)", async () => {
    await expect(getPublicEnabled()).resolves.toBe(true);
  });

  test("setPublicEnabled(false)가 싱글톤 row를 생성한다", async () => {
    await setPublicEnabled(false);
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    expect(row?.publicEnabled).toBe(false);
  });

  test("setPublicEnabled(true)가 기존 row를 갱신한다(upsert update)", async () => {
    await setPublicEnabled(true);
    const rows = await prisma.siteConfig.findMany();
    expect(rows).toHaveLength(1); // 싱글톤 — 중복 생성 없음
    expect(rows[0].publicEnabled).toBe(true);
  });
});
