import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { setupTestDb } from "@/lib/test-db";
import { makeComment, makeFeed, makeUser } from "@/lib/test-factories";

type Db = Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let prisma: Db;
let cleanup: () => Promise<void>;
let dir: string;
let m: typeof import("@/lib/upload-cleanup");

const NOW = new Date("2026-11-27T00:00:00Z");
const DAY = 86_400_000;

// 업로드 파일을 만들고 수정 시각을 daysAgo일 전으로.
function file(name: string, daysAgo: number) {
  const p = join(dir, name);
  writeFileSync(p, "x");
  const t = new Date(NOW.getTime() - daysAgo * DAY);
  utimesSync(p, t, t);
  return name;
}
const exists = (name: string) => existsSync(join(dir, name));
const n = (i: number) =>
  `00000000-0000-4000-8000-${String(i).padStart(12, "0")}.png`;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "uploads-cleanup-"));
  process.env.UPLOAD_DIR = dir;
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  m = await import("@/lib/upload-cleanup");
});
afterAll(async () => {
  await cleanup();
  rmSync(dir, { recursive: true, force: true });
});

describe("pruneOrphanUploads", () => {
  test("어디에서도 참조하지 않고 유예 기간이 지난 파일만 삭제(기록도 함께)", async () => {
    const u = await makeUser(prisma, { avatarUrl: `/uploads/${n(1)}?w=1&h=1` });
    const f = await makeFeed(prisma, {
      content: `본문 ![](/uploads/${n(2)}?w=4&h=3)`,
      summary: `요약 /uploads/${n(3)}`,
    });
    await prisma.feedRevision.create({
      data: { feedId: f.id, title: "옛", content: `![](/uploads/${n(4)})` },
    });
    await prisma.siteConfig.upsert({
      where: { id: 1 },
      create: { id: 1, aboutContent: `![](/uploads/${n(5)})` },
      update: { aboutContent: `![](/uploads/${n(5)})` },
    });
    await makeComment(prisma, f.id, u.id, { content: `/uploads/${n(6)}` });
    await prisma.series.create({
      data: { title: "s", slug: "s", description: `/uploads/${n(7)}` },
    });
    for (let i = 1; i <= 7; i++) file(n(i), 60); // 오래됐지만 참조 중 → 보존
    const orphanOld = file(n(8), 31); // 참조 없음 + 유예(30일) 지남 → 삭제
    const orphanNew = file(n(9), 3); // 참조 없음이지만 최근(작성 중 초안 등) → 보존
    file(".gitkeep", 90); // 업로드 이름 형식이 아닌 파일은 건드리지 않음
    await prisma.upload.create({
      data: { name: orphanOld, ownerId: u.id, kind: "post" },
    });

    const r = await m.pruneOrphanUploads(NOW);
    expect(r).toEqual({ deleted: 1 });
    expect(exists(orphanOld)).toBe(false);
    expect(
      await prisma.upload.findUnique({ where: { name: orphanOld } }),
    ).toBeNull();
    for (let i = 1; i <= 7; i++) expect(exists(n(i))).toBe(true);
    expect(exists(orphanNew)).toBe(true);
    expect(exists(".gitkeep")).toBe(true);
  });

  test("업로드 폴더가 없으면 0건(처음 배포 등)", async () => {
    expect(await m.pruneOrphanUploads(NOW, join(dir, "missing"))).toEqual({
      deleted: 0,
    });
  });
});
