import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

type Follows = typeof import("@/lib/follows");
let m: Follows;
let cleanup: () => Promise<void>;
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];

// alice·bob 승인 회원, carol 미승인, adminU 관리자. bob의 글: 공개·회원·초안·숨김.
beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma;

  const user = (id: string, role: string, status: string) =>
    prisma.user.create({
      data: {
        id,
        email: `${id}@x.com`,
        nickname: id,
        passwordHash: "x",
        role,
        status,
        updatedAt: new Date(),
      },
    });
  await user("alice", "member", "approved");
  await user("bob", "member", "approved");
  await user("carol", "member", "pending");
  await user("adminU", "admin", "approved");

  const feed = (
    id: string,
    visibility: string,
    status: string,
    day: number,
    hidden = false,
  ) =>
    prisma.feed.create({
      data: {
        id,
        slug: id,
        title: `글-${id}`,
        content: "x",
        visibility,
        status,
        authorId: "bob",
        hiddenAt: hidden ? new Date() : null,
        publishedAt: status === "published" ? new Date(2026, 0, day) : null,
        createdAt: new Date(2026, 0, day),
        updatedAt: new Date(2026, 0, day),
      },
    });
  await feed("b-pub", "public", "published", 1);
  await feed("b-mem", "members", "published", 2);
  await feed("b-draft", "members", "draft", 3);
  await feed("b-hidden", "members", "published", 4, true);

  m = await import("@/lib/follows");
});

afterAll(async () => {
  await cleanup();
});

describe("followUser 검증", () => {
  test("자기 자신은 거부", async () => {
    expect(await m.followUser("alice", "alice")).toHaveProperty("error");
  });
  test("관리자·미승인·미존재 대상 거부", async () => {
    expect(await m.followUser("alice", "adminU")).toHaveProperty("error");
    expect(await m.followUser("alice", "carol")).toHaveProperty("error");
    expect(await m.followUser("alice", "nope")).toHaveProperty("error");
  });
  test("정상 팔로우 + 중복은 무시(idempotent)", async () => {
    expect(await m.followUser("alice", "bob")).toEqual({ ok: true });
    expect(await m.followUser("alice", "bob")).toEqual({ ok: true });
    const counts = await m.getFollowCounts("bob");
    expect(counts.followers).toBe(1);
    expect((await m.getFollowCounts("alice")).following).toBe(1);
  });
});

describe("isFollowing / getFollowingIds", () => {
  test("팔로우 관계 반영", async () => {
    expect(await m.isFollowing("alice", "bob")).toBe(true);
    expect(await m.isFollowing("bob", "alice")).toBe(false);
    expect(await m.getFollowingIds("alice")).toEqual(["bob"]);
  });
});

describe("getFollowingFeed 가시성·순서", () => {
  test("회원 뷰어: 팔로우한 회원의 공개+회원 글만 최신순(초안·숨김 제외)", async () => {
    const { items } = await m.getFollowingFeed("alice", "member");
    expect(items.map((f) => f.slug)).toEqual(["b-mem", "b-pub"]); // 02→01 최신순
  });
  test("팔로우 안 한 회원은 빈 피드", async () => {
    const { items } = await m.getFollowingFeed("bob", "member");
    expect(items).toEqual([]);
  });
  test("언팔로우하면 피드에서 사라짐", async () => {
    await m.unfollowUser("alice", "bob");
    expect(await m.isFollowing("alice", "bob")).toBe(false);
    const { items } = await m.getFollowingFeed("alice", "member");
    expect(items).toEqual([]);
    expect((await m.getFollowCounts("bob")).followers).toBe(0);
  });
});
