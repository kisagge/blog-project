import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeComment, makeFeed, makeUser } from "@/lib/test-factories";

type Db = Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let prisma: Db;
let cleanup: () => Promise<void>;
let w: typeof import("@/lib/withdrawal");
let users: typeof import("@/lib/users");

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  w = await import("@/lib/withdrawal");
  users = await import("@/lib/users");
});
afterAll(async () => {
  await cleanup();
});

// 탈퇴할 회원 + 주변 데이터(남의 글에 단 댓글, 내 글에 달린 남의 댓글, 팔로우·알림·저장·임시저장).
async function setup() {
  const me = await makeUser(prisma, {
    email: `me${Math.random()}@x.com`,
    nickname: `나${Math.random().toString(36).slice(2, 6)}`,
    bio: "소개",
    avatarUrl: "/uploads/avatar.png",
  });
  const other = await makeUser(prisma);
  const othersFeed = await makeFeed(prisma, {
    authorId: other.id,
    status: "published",
  });
  const myFeed = await makeFeed(prisma, {
    authorId: me.id,
    status: "published",
    visibility: "members",
  });
  const myDraft = await makeFeed(prisma, {
    authorId: me.id,
    status: "draft",
    visibility: "members",
  });
  const myComment = await makeComment(prisma, othersFeed.id, me.id);
  const reply = await makeComment(prisma, othersFeed.id, other.id, {
    parentId: myComment.id,
  });
  const onMyFeed = await makeComment(prisma, myFeed.id, other.id);
  await prisma.like.create({ data: { feedId: othersFeed.id, userId: me.id } });
  await prisma.bookmark.create({
    data: { feedId: othersFeed.id, userId: me.id },
  });
  await prisma.follow.create({
    data: { followerId: me.id, followingId: other.id },
  });
  await prisma.follow.create({
    data: { followerId: other.id, followingId: me.id },
  });
  await prisma.notification.create({ data: { userId: me.id, body: "알림" } });
  return { me, other, othersFeed, myFeed, myDraft, myComment, reply, onMyFeed };
}

describe("withdrawMember — 기본(글·댓글 보존, 개인정보 익명화)", () => {
  test("개인정보는 지우고 글·댓글·좋아요는 '탈퇴한 회원'으로 남김", async () => {
    const s = await setup();
    const r = await w.withdrawMember(s.me.id, { deletePosts: false });
    expect(r.ok).toBe(true);

    const u = await prisma.user.findUniqueOrThrow({ where: { id: s.me.id } });
    expect(u).toMatchObject({
      nickname: w.WITHDRAWN_NICKNAME,
      role: "withdrawn",
      status: "withdrawn",
      bio: null,
      avatarUrl: null,
      passwordHash: "-",
      notifyOnReply: false,
      notifyOnComment: false,
      notifyOnMention: false,
      notifyOnFollow: false,
    });
    expect(u.email).not.toContain("@x.com"); // 원래 이메일 비보관
    expect(u.withdrawnAt).toBeInstanceOf(Date);
    expect(u.sessionVersion).toBe(s.me.sessionVersion + 1); // 다른 기기 로그인 무효

    // 보존: 게시 글·내 댓글·남의 답글·내 글의 남의 댓글·좋아요
    expect(
      await prisma.feed.findUnique({ where: { id: s.myFeed.id } }),
    ).not.toBeNull();
    for (const id of [s.myComment.id, s.reply.id, s.onMyFeed.id])
      expect(await prisma.comment.findUnique({ where: { id } })).not.toBeNull();
    expect(await prisma.like.count({ where: { userId: s.me.id } })).toBe(1);

    // 삭제: 임시저장(비공개 미완성 글)·팔로우 양방향·알림·저장
    expect(
      await prisma.feed.findUnique({ where: { id: s.myDraft.id } }),
    ).toBeNull();
    expect(
      await prisma.follow.count({
        where: { OR: [{ followerId: s.me.id }, { followingId: s.me.id }] },
      }),
    ).toBe(0);
    expect(
      await prisma.notification.count({ where: { userId: s.me.id } }),
    ).toBe(0);
    expect(await prisma.bookmark.count({ where: { userId: s.me.id } })).toBe(0);
  });

  test("탈퇴 회원은 공개 프로필 404·회원 목록 제외·로그인 불가", async () => {
    const s = await setup();
    await w.withdrawMember(s.me.id, { deletePosts: false });
    expect(await users.getMemberProfile(s.me.id)).toBeNull();
    const list = await users.listUsersByStatus("approved");
    expect(list.some((x) => x.id === s.me.id)).toBe(false);
  });

  test("이미 탈퇴했거나 회원이 아니면 거부", async () => {
    const s = await setup();
    await w.withdrawMember(s.me.id, { deletePosts: false });
    expect((await w.withdrawMember(s.me.id, { deletePosts: false })).ok).toBe(
      false,
    );
    expect(
      (await w.withdrawMember("no-such-id", { deletePosts: false })).ok,
    ).toBe(false);
  });

  test("'탈퇴한 회원' 닉네임은 새 회원이 쓸 수 없음(사칭 방지)", async () => {
    expect(await users.isNicknameTaken(w.WITHDRAWN_NICKNAME)).toBe(true);
  });
});

describe("withdrawMember — 글도 함께 삭제", () => {
  test("내 글(과 그 아래 댓글)은 삭제, 남의 글에 단 내 댓글은 보존", async () => {
    const s = await setup();
    await w.withdrawMember(s.me.id, { deletePosts: true });
    expect(await prisma.feed.count({ where: { authorId: s.me.id } })).toBe(0);
    expect(
      await prisma.comment.findUnique({ where: { id: s.onMyFeed.id } }),
    ).toBeNull();
    expect(
      await prisma.comment.findUnique({ where: { id: s.myComment.id } }),
    ).not.toBeNull();
  });
});

describe("차단 회원 탈퇴 → 같은 이메일 재가입 차단", () => {
  test("차단 상태로 탈퇴하면 이메일 해시만 보관하고 재가입을 막음, 일반 탈퇴는 재가입 허용", async () => {
    const blocked = await makeUser(prisma, {
      email: "bad@x.com",
      nickname: "차단됨",
      status: "blocked",
    });
    await w.withdrawMember(blocked.id, { deletePosts: false });
    expect(await prisma.blockedEmail.count()).toBe(1);
    const row = await prisma.blockedEmail.findFirstOrThrow();
    expect(row.emailHash).not.toContain("bad");
    expect(
      await users.createPendingUser({
        email: " BAD@x.com ",
        nickname: "새이름",
        password: "Aa1!aaaa",
      }),
    ).toEqual({ ok: false, error: users.BLOCKED_SIGNUP_MESSAGE });

    const normal = await makeUser(prisma, {
      email: "fine@x.com",
      nickname: "보통",
    });
    await w.withdrawMember(normal.id, { deletePosts: false });
    expect(
      (
        await users.createPendingUser({
          email: "fine@x.com",
          nickname: "다시옴",
          password: "Aa1!aaaa",
        })
      ).ok,
    ).toBe(true);
  });
});

describe("탈퇴 회원 표시", () => {
  test("댓글: '탈퇴한 회원'이며 회원 프로필 링크 대상 아님", async () => {
    const s = await setup();
    await w.withdrawMember(s.me.id, { deletePosts: false });
    const { getFeedComments } = await import("@/lib/comments");
    const page = await getFeedComments(s.othersFeed.id, {});
    const mine = page.items.find((c) => c.id === s.myComment.id)!;
    expect(mine.nickname).toBe(w.WITHDRAWN_NICKNAME);
    expect(mine.authorRole).toBe("withdrawn");
  });

  test("글 카드: 작성자명은 '탈퇴한 회원', 프로필 링크(authorId) 없음", async () => {
    const { toFeedCard } = await import("@/app/feed/(list)/feed-card");
    const card = toFeedCard({
      slug: "s",
      title: "t",
      summary: null,
      createdAt: new Date(),
      viewCount: 0,
      visibility: "members",
      author: { id: "u1", nickname: w.WITHDRAWN_NICKNAME, role: "withdrawn" },
    });
    expect(card.authorName).toBe(w.WITHDRAWN_NICKNAME);
    expect(card.authorId).toBeNull();
  });
});
