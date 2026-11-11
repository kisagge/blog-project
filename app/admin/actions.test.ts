import { vi } from "vitest";
vi.mock("server-only", () => ({}));
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

type Actions = typeof import("@/app/admin/actions");
let updateFeed: Actions["updateFeed"];
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma;
  ({ updateFeed } = await import("@/app/admin/actions"));
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

function form(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

// 저장 성공 시 redirect("/admin")가 throw → 정상 경로로 간주.
async function save(id: string, patch: Record<string, string>) {
  await expect(updateFeed(id, {}, form({ ...base, ...patch }))).rejects.toThrow(
    "NEXT_REDIRECT",
  );
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

describe("saveAboutAction", () => {
  const fd = (content: string) => {
    const f = new FormData();
    f.set("content", content);
    return f;
  };

  test("관리자 세션 확인 후 저장 + 감사 로그 + 레이아웃 재검증", async () => {
    const { saveAboutAction } = await import("@/app/admin/actions");
    const { verifySession } = await import("@/lib/dal");
    const { logAudit } = await import("@/lib/audit");
    const { revalidatePath } = await import("next/cache");

    await expect(
      saveAboutAction({}, fd("# 소개\n\n반가워요")),
    ).resolves.toEqual({ ok: true });
    expect(verifySession).toHaveBeenCalled();
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    expect(row?.aboutContent).toBe("# 소개\n\n반가워요");
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "site.about", targetType: "site" }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("길이 초과는 저장하지 않고 에러 반환", async () => {
    const { saveAboutAction } = await import("@/app/admin/actions");
    const { ABOUT_MAX_LENGTH } = await import("@/lib/validation");
    const res = await saveAboutAction({}, fd("x".repeat(ABOUT_MAX_LENGTH + 1)));
    expect(res.error).toMatch(/이하로 입력/);
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    expect(row?.aboutContent).toBe("# 소개\n\n반가워요"); // 이전 값 유지
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
    const { restoreRevisionAction } = await import("@/app/admin/actions");
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
