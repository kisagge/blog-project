import { vi } from "vitest";
vi.mock("@/lib/dal", () => ({ verifySession: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { formData } from "@/test/helpers";

type Actions = typeof import("@/app/admin/feed-actions");
let updateFeed: Actions["updateFeed"];
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma;
  ({ updateFeed } = await import("@/app/admin/feed-actions"));
});
afterAll(async () => {
  await cleanup();
});

const base = {
  title: "원제",
  slug: "edit-me",
  summary: "요약",
  content: "원문",
  visibility: "public",
};

// 저장 성공 시 redirect("/admin")가 throw → 정상 경로로 간주.
async function save(id: string, patch: Record<string, string>) {
  await expect(
    updateFeed(id, {}, formData({ ...base, ...patch })),
  ).rejects.toThrow("NEXT_REDIRECT");
  return prisma.feed.findUniqueOrThrow({ where: { id } });
}

describe("updateFeed — editedAt", () => {
  test("게시 글: 공개범위만 바꾸면 미기록, 본문이 바뀌면 기록", async () => {
    const { id } = await prisma.feed.create({
      data: { ...base, status: "published" },
    });
    expect((await save(id, { visibility: "members" })).editedAt).toBeNull();
    expect((await save(id, { content: "고친 본문" })).editedAt).toBeInstanceOf(
      Date,
    );
  });

  test("초안(예약 글 등) 편집은 수정으로 보지 않음", async () => {
    const { id } = await prisma.feed.create({
      data: { ...base, slug: "draft-edit", status: "draft" },
    });
    expect(
      (await save(id, { slug: "draft-edit", content: "고친 본문" })).editedAt,
    ).toBeNull();
  });
});

describe("수정 이력(리비전)", () => {
  test("updateFeed: 본문이 바뀐 저장만 직전 버전을 이력으로, 공개범위만 바꾸면 이력 없음", async () => {
    const { id } = await prisma.feed.create({
      data: { ...base, slug: "rev-save", status: "published" },
    });
    await save(id, { slug: "rev-save", visibility: "members" });
    expect(await prisma.feedRevision.count({ where: { feedId: id } })).toBe(0);

    await save(id, { slug: "rev-save", content: "새 본문" });
    const revs = await prisma.feedRevision.findMany({ where: { feedId: id } });
    expect(revs).toHaveLength(1);
    expect(revs[0]).toMatchObject({ title: "원제", content: "원문" });
  });

  test("restoreRevisionAction: 되돌린 뒤 감사 로그 + 이력 화면으로 이동", async () => {
    const { restoreRevisionAction } = await import("@/app/admin/feed-actions");
    const { logAudit } = await import("@/lib/audit");
    const { redirect } = await import("next/navigation");
    const { id } = await prisma.feed.create({
      data: { ...base, slug: "rev-restore", status: "published" },
    });
    const rev = await prisma.feedRevision.create({
      data: { feedId: id, title: "옛 제목", content: "옛 본문" },
    });
    await expect(restoreRevisionAction(rev.id)).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirect).toHaveBeenLastCalledWith(
      `/admin/${id}/revisions?restored=1`,
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "feed.restore", targetId: id }),
    );
    expect(
      (await prisma.feed.findUniqueOrThrow({ where: { id } })).content,
    ).toBe("옛 본문");
  });
});

describe("실패 응답의 제출값(입력 유지)", () => {
  test("검증 실패 시 제출값을 그대로 돌려줌(폼 초기화 후 다시 채우기용)", async () => {
    const { id } = await prisma.feed.create({
      data: { ...base, slug: "keep-values", status: "published" },
    });
    const res = await updateFeed(
      id,
      {},
      formData({ ...base, slug: "BAD SLUG", content: "긴 본문" }),
    );
    expect(res?.errors?.slug?.length).toBeGreaterThan(0);
    expect(res?.values).toMatchObject({
      title: "원제",
      slug: "BAD SLUG",
      content: "긴 본문",
      visibility: "public",
    });
  });
});
