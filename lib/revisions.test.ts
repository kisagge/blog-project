import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Mod = typeof import("@/lib/revisions");
let m: Mod;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  m = await import("@/lib/revisions");
});
afterAll(async () => {
  await cleanup();
});

let n = 0;
const mkFeed = (over: Record<string, unknown> = {}) =>
  prisma.feed.create({
    data: {
      slug: `rev-${++n}`,
      title: "현재 제목",
      summary: "현재 요약",
      content: "현재 본문",
      status: "published",
      ...over,
    },
  });

describe("snapshotRevision", () => {
  test("이전 버전을 저장하고 글당 REVISION_LIMIT개만 보존(오래된 것부터 삭제)", async () => {
    const feed = await mkFeed();
    for (let i = 0; i < m.REVISION_LIMIT + 3; i++) {
      await m.snapshotRevision(prisma, feed.id, {
        title: `v${i}`,
        summary: null,
        content: `본문 ${i}`,
      });
    }
    const list = await m.listRevisions(feed.id);
    expect(list).toHaveLength(m.REVISION_LIMIT);
    expect(list[0].title).toBe(`v${m.REVISION_LIMIT + 2}`); // 최신순
    expect(list.map((r) => r.title)).not.toContain("v0");
    expect(list[0].length).toBe(`본문 ${m.REVISION_LIMIT + 2}`.length);
  });

  test("같은 순간에 연달아 저장해도 순서가 결정적(시각이 엄격히 증가)", async () => {
    const feed = await mkFeed();
    for (let i = 0; i < 5; i++)
      await m.snapshotRevision(prisma, feed.id, {
        title: `t${i}`,
        summary: null,
        content: "c",
      });
    const rows = await prisma.feedRevision.findMany({
      where: { feedId: feed.id },
      orderBy: { createdAt: "asc" },
    });
    expect(rows.map((r) => r.title)).toEqual(["t0", "t1", "t2", "t3", "t4"]);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i].createdAt.getTime()).toBeGreaterThan(
        rows[i - 1].createdAt.getTime(),
      );
  });

  test("글 삭제 시 이력도 함께 삭제", async () => {
    const feed = await mkFeed();
    await m.snapshotRevision(prisma, feed.id, {
      title: "a",
      summary: null,
      content: "b",
    });
    await prisma.feed.delete({ where: { id: feed.id } });
    expect(
      await prisma.feedRevision.count({ where: { feedId: feed.id } }),
    ).toBe(0);
  });
});

describe("restoreRevision", () => {
  test("되돌리면 현재 버전을 먼저 이력으로 남기고 교체 + 게시 글 수정일 갱신", async () => {
    const feed = await mkFeed();
    await m.snapshotRevision(prisma, feed.id, {
      title: "옛 제목",
      summary: "옛 요약",
      content: "옛 본문",
    });
    const [old] = await m.listRevisions(feed.id);

    const res = await m.restoreRevision(old.id);
    expect(res).toEqual({
      ok: true,
      feedId: feed.id,
      title: "옛 제목",
      changed: true,
    });
    const after = await prisma.feed.findUniqueOrThrow({
      where: { id: feed.id },
    });
    expect(after).toMatchObject({
      title: "옛 제목",
      summary: "옛 요약",
      content: "옛 본문",
    });
    expect(after.editedAt).toBeInstanceOf(Date);
    // 되돌리기 직전 버전(현재 제목)이 최신 이력으로 → 되돌리기도 되돌릴 수 있음
    const list = await m.listRevisions(feed.id);
    expect(list[0].title).toBe("현재 제목");
    expect(list).toHaveLength(2);
  });

  test("이미 같은 내용이면 이력·수정일 변화 없음", async () => {
    const feed = await mkFeed();
    await m.snapshotRevision(prisma, feed.id, {
      title: "현재 제목",
      summary: "현재 요약",
      content: "현재 본문",
    });
    const [rev] = await m.listRevisions(feed.id);
    expect(await m.restoreRevision(rev.id)).toMatchObject({ changed: false });
    expect(await m.countRevisions(feed.id)).toBe(1);
    expect(
      (await prisma.feed.findUniqueOrThrow({ where: { id: feed.id } }))
        .editedAt,
    ).toBeNull();
  });

  test("초안 되돌리기는 수정일을 남기지 않음, 없는 이력은 오류", async () => {
    const feed = await mkFeed({ status: "draft" });
    await m.snapshotRevision(prisma, feed.id, {
      title: "초안 옛 제목",
      summary: null,
      content: "x",
    });
    const [rev] = await m.listRevisions(feed.id);
    await m.restoreRevision(rev.id);
    expect(
      (await prisma.feed.findUniqueOrThrow({ where: { id: feed.id } }))
        .editedAt,
    ).toBeNull();
    expect(await m.restoreRevision("nope")).toEqual({
      ok: false,
      error: "이력을 찾을 수 없습니다.",
    });
  });
});
