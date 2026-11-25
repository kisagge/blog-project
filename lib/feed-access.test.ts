import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import type { ViewerRole } from "@/lib/visibility";

type Mod = typeof import("@/lib/feed-access");
let m: Mod;
let prisma: import("@/app/generated/prisma/client").PrismaClient;
let cleanup: () => Promise<void>;
const ids: Record<string, string> = {};
const commentIds: Record<string, string> = {};

// 상태별 글: 이름 → 필드
const FEEDS = {
  pub: { visibility: "public", status: "published" },
  mem: { visibility: "members", status: "published" },
  priv: { visibility: "private", status: "published" },
  draft: { visibility: "public", status: "draft" },
  hidden: { visibility: "public", status: "published", hiddenAt: new Date() },
} as const;

// 기대값: [anon, member, admin]
const EXPECT: Record<keyof typeof FEEDS, [boolean, boolean, boolean]> = {
  pub: [true, true, true],
  mem: [false, true, true],
  priv: [false, false, true],
  draft: [false, false, true],
  hidden: [false, false, true],
};
const ROLES: ViewerRole[] = ["anon", "member", "admin"];

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  const u = await prisma.user.create({
    data: {
      email: "fa@x.com",
      nickname: "게이트",
      passwordHash: "-",
      status: "approved",
    },
  });
  for (const [name, f] of Object.entries(FEEDS)) {
    const feed = await prisma.feed.create({
      data: { slug: `fa-${name}`, title: name, content: "c", ...f },
    });
    ids[name] = feed.id;
    const c = await prisma.comment.create({
      data: { feedId: feed.id, userId: u.id, content: "hi" },
    });
    commentIds[name] = c.id;
  }
  m = await import("@/lib/feed-access");
});
afterAll(async () => {
  await cleanup();
});

describe("feed-access", () => {
  for (const name of Object.keys(FEEDS) as (keyof typeof FEEDS)[]) {
    ROLES.forEach((role, i) => {
      const ok = EXPECT[name][i];
      test(`${name} × ${role} → ${ok ? "허용" : "거부"}`, async () => {
        const feed = await m.getReadableFeed(ids[name], role);
        const viaComment = await m.getReadableCommentFeed(
          commentIds[name],
          role,
        );
        if (ok) {
          expect(feed).toEqual({ id: ids[name], slug: `fa-${name}` });
          expect(viaComment).toEqual({ id: ids[name], slug: `fa-${name}` });
        } else {
          expect(feed).toBeNull();
          expect(viaComment).toBeNull();
        }
      });
    });
  }

  test("없는 글·댓글, 문자열이 아닌 id는 null", async () => {
    expect(await m.getReadableFeed("nope", "admin")).toBeNull();
    expect(await m.getReadableCommentFeed("nope", "admin")).toBeNull();
    expect(
      await m.getReadableFeed(42 as unknown as string, "admin"),
    ).toBeNull();
    expect(
      await m.getReadableCommentFeed({} as unknown as string, "admin"),
    ).toBeNull();
  });
});

describe("feedDetailView(글 상세 화면 판정)", () => {
  const base = {
    status: "published",
    hiddenAt: null as Date | null,
    visibility: "public",
    authorId: "u1" as string | null,
  };
  const anon = undefined;
  const author = { role: "member" as const, userId: "u1" };
  const other = { role: "member" as const, userId: "u2" };
  const admin = { role: "admin" as const };

  test("임시저장: 작성자·관리자만 미리보기, 그 외 404", async () => {
    const { feedDetailView } = await import("@/lib/feed-access");
    const draft = { ...base, status: "draft" };
    expect(feedDetailView(draft, "member", author)).toBe("draft-preview");
    expect(feedDetailView(draft, "admin", admin)).toBe("draft-preview");
    expect(feedDetailView(draft, "member", other)).toBe("not-found");
    expect(feedDetailView(draft, "anon", anon)).toBe("not-found");
  });

  test("신고로 숨김: 관리자만", async () => {
    const { feedDetailView } = await import("@/lib/feed-access");
    const hidden = { ...base, hiddenAt: new Date() };
    expect(feedDetailView(hidden, "admin", admin)).toBe("ok");
    expect(feedDetailView(hidden, "member", author)).toBe("not-found");
  });

  test("공개 범위: 회원공개는 비회원에게 가입 안내, 비공개는 관리자 외 404", async () => {
    const { feedDetailView } = await import("@/lib/feed-access");
    const members = { ...base, visibility: "members" };
    const priv = { ...base, visibility: "private" };
    expect(feedDetailView(base, "anon", anon)).toBe("ok");
    expect(feedDetailView(members, "anon", anon)).toBe("members-only");
    expect(feedDetailView(members, "member", other)).toBe("ok");
    expect(feedDetailView(priv, "member", author)).toBe("not-found");
    expect(feedDetailView(priv, "admin", admin)).toBe("ok");
  });
});
