import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeUser } from "@/lib/test-factories";

vi.mock("server-only", () => ({}));

type M = typeof import("@/lib/member-posts");
type Prisma = (typeof import("@/lib/prisma"))["prisma"];
let m: M;
let prisma: Prisma;
let cleanup: () => Promise<void>;
let userId: string;
let otherId: string;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma as Prisma;
  m = await import("@/lib/member-posts");
  userId = (await makeUser(prisma)).id;
  otherId = (await makeUser(prisma)).id;
});
afterAll(async () => {
  await cleanup();
});

describe("member-posts 임시저장", () => {
  test("임시저장은 최대 3개, 4번째는 거부", async () => {
    for (let i = 0; i < m.DRAFT_LIMIT; i++) {
      const r = await m.saveDraft(userId, { title: `초안${i}`, content: "본문" });
      expect(r.ok).toBe(true);
    }
    expect(await m.countMyDrafts(userId)).toBe(3);
    const over = await m.saveDraft(userId, { title: "초과", content: "본문" });
    expect(over.ok).toBe(false);
  });

  test("기존 임시저장 수정은 한도와 무관(본인 글)", async () => {
    const drafts = await m.listMyDrafts(userId);
    const r = await m.saveDraft(userId, {
      id: drafts[0].id,
      title: "수정됨",
      content: "수정 본문",
    });
    expect(r.ok).toBe(true);
    const got = await m.getMyPost(userId, drafts[0].id);
    expect(got?.title).toBe("수정됨");
  });

  test("타인 글은 수정 불가", async () => {
    const drafts = await m.listMyDrafts(userId);
    const r = await m.saveDraft(otherId, {
      id: drafts[0].id,
      title: "탈취",
      content: "x",
    });
    expect(r.ok).toBe(false);
    expect(await m.getMyPost(otherId, drafts[0].id)).toBeNull();
  });
});

describe("member-posts 게시", () => {
  test("임시저장 → 게시: status·publishedAt 기록, 임시저장 슬롯 반환", async () => {
    const before = await m.countMyDrafts(userId);
    const drafts = await m.listMyDrafts(userId);
    const r = await m.publishPost(userId, {
      id: drafts[0].id,
      title: "게시글",
      content: "본문",
    });
    expect(r.ok).toBe(true);
    const row = await prisma.feed.findFirst({ where: { id: drafts[0].id } });
    expect(row?.status).toBe("published");
    expect(row?.publishedAt).not.toBeNull();
    expect(await m.countMyDrafts(userId)).toBe(before - 1);
  });

  test("하루 게시 제한 초과 시 거부", async () => {
    const fresh = await makeUser(prisma);
    for (let i = 0; i < m.DAILY_PUBLISH_LIMIT; i++) {
      const r = await m.publishPost(fresh.id, {
        title: `글${i}`,
        content: "본문",
      });
      expect(r.ok).toBe(true);
    }
    const over = await m.publishPost(fresh.id, { title: "초과", content: "본문" });
    expect(over.ok).toBe(false);
  });

  test("이미 게시된 글 수정은 하루 제한과 무관", async () => {
    const fresh = await makeUser(prisma);
    // 한도까지 게시
    let last = "";
    for (let i = 0; i < m.DAILY_PUBLISH_LIMIT; i++) {
      const r = await m.publishPost(fresh.id, {
        title: `g${i}`,
        content: "본문",
      });
      if (r.ok) last = r.value.slug;
    }
    const post = await prisma.feed.findFirst({ where: { slug: last } });
    // 한도를 다 썼지만 기존 글 수정은 허용
    const r = await m.publishPost(fresh.id, {
      id: post!.id,
      title: "수정된 제목",
      content: "수정",
    });
    expect(r.ok).toBe(true);
  });

  test("게시 글 slug는 회원공개·고유", async () => {
    const r = await m.publishPost(otherId, { title: "Hello World", content: "c" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const row = await prisma.feed.findFirst({ where: { slug: r.value.slug } });
      expect(row?.visibility).toBe("members");
      expect(row?.authorId).toBe(otherId);
    }
  });
});

describe("member-posts 삭제", () => {
  test("본인 글만 삭제 가능", async () => {
    const r = await m.publishPost(userId, { title: "삭제대상", content: "c" });
    const row = await prisma.feed.findFirst({
      where: { authorId: userId, title: "삭제대상" },
    });
    expect(await m.deleteMyPost(otherId, row!.id)).toMatchObject({ ok: false });
    expect(await m.deleteMyPost(userId, row!.id)).toMatchObject({ ok: true });
    expect(await prisma.feed.findFirst({ where: { id: row!.id } })).toBeNull();
    void r;
  });
});
