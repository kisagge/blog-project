import { afterAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

let cleanup: () => Promise<void> = async () => {};
afterAll(() => cleanup());

describe("SQLite 연결 설정", () => {
  test("WAL + synchronous=NORMAL(WAL 권장값 — 커밋마다 fsync로 메인 스레드가 멈추지 않게)", async () => {
    const db = await setupTestDb();
    cleanup = db.cleanup;
    const [journal] = await db.prisma.$queryRawUnsafe<
      { journal_mode: string }[]
    >("PRAGMA journal_mode");
    const [sync] =
      await db.prisma.$queryRawUnsafe<{ synchronous: number | bigint }[]>(
        "PRAGMA synchronous",
      );
    expect(journal.journal_mode).toBe("wal");
    expect(Number(sync.synchronous)).toBe(1); // 0=OFF 1=NORMAL 2=FULL
  });
});
