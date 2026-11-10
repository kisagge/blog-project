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
