import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeUser, makeFeed, makeComment } from "@/lib/test-factories";

vi.mock("server-only", () => ({}));

type M = typeof import("@/lib/reports");
type Db = (typeof import("@/lib/prisma"))["prisma"];
let m: M;
let prisma: Db;
let cleanup: () => Promise<void>;

let author: string; // 콘텐츠 작성자(회원)
let reporter: string; // 신고자(회원)
let other: string; // 또 다른 신고자
let commentId: string; // author의 댓글
let memberFeedId: string; // author의 회원 글
let adminFeedId: string; // 관리자 글(authorId null)

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma as Db;
  cleanup = db.cleanup;
  m = await import("@/lib/reports");

  author = (await makeUser(prisma)).id;
  reporter = (await makeUser(prisma)).id;
  other = (await makeUser(prisma)).id;
  const feed = await makeFeed(prisma, { slug: "host", title: "호스트글" });
  commentId = (await makeComment(prisma, feed.id, author, { content: "내 댓글" }))
    .id;
  memberFeedId = (
    await makeFeed(prisma, {
      slug: "member-post",
      title: "회원 글",
      visibility: "members",
      status: "published",
      authorId: author,
    })
  ).id;
  adminFeedId = (await makeFeed(prisma, { slug: "admin-post" })).id; // authorId null
});
afterAll(async () => {
  await cleanup();
});

describe("createReport", () => {
  test("타인 댓글 신고 적재(created=true), 중복은 created=false", async () => {
    const r1 = await m.createReport({
      reporterId: reporter,
      targetType: "comment",
      targetId: commentId,
      reason: "spam",
    });
    expect(r1).toEqual({ ok: true, created: true, firstForTarget: true });
    const r2 = await m.createReport({
      reporterId: reporter,
      targetType: "comment",
      targetId: commentId,
      reason: "abuse", // 사유 달라도 같은 (대상,신고자)면 무시
    });
    expect(r2).toEqual({ ok: true, created: false, firstForTarget: false });
    expect(
      await prisma.report.count({
        where: { targetType: "comment", targetId: commentId },
      }),
    ).toBe(1);
  });

  test("본인 콘텐츠 신고는 거부", async () => {
    const r = await m.createReport({
      reporterId: author,
      targetType: "comment",
      targetId: commentId,
      reason: "spam",
    });
    expect(r).toEqual({ ok: false, error: "본인 콘텐츠는 신고할 수 없습니다." });
  });

  test("없는 대상은 거부", async () => {
    const r = await m.createReport({
      reporterId: reporter,
      targetType: "comment",
      targetId: "nope",
      reason: "spam",
    });
    expect(r.ok).toBe(false);
  });

  test("관리자 글(authorId null)은 신고 대상 아님", async () => {
    const r = await m.createReport({
      reporterId: reporter,
      targetType: "feed",
      targetId: adminFeedId,
      reason: "spam",
    });
    expect(r.ok).toBe(false);
  });

  test("관리자 댓글은 신고 대상 아님", async () => {
    const admin = await makeUser(prisma, {
      email: "adm@test.local",
      nickname: "관리",
      role: "admin",
    });
    const feed = await makeFeed(prisma, { slug: "ac-feed" });
    const ac = await makeComment(prisma, feed.id, admin.id, {
      content: "관리자 댓글",
    });
    const r = await m.createReport({
      reporterId: reporter,
      targetType: "comment",
      targetId: ac.id,
      reason: "spam",
    });
    expect(r).toEqual({ ok: false, error: "신고할 수 없는 콘텐츠입니다." });
  });

  test("회원 글 신고는 적재", async () => {
    const r = await m.createReport({
      reporterId: reporter,
      targetType: "feed",
      targetId: memberFeedId,
      reason: "etc",
      detail: "  설명  ",
    });
    expect(r).toEqual({ ok: true, created: true, firstForTarget: true });
    const row = await prisma.report.findFirst({
      where: { targetType: "feed", targetId: memberFeedId },
    });
    expect(row?.detail).toBe("설명"); // trim
  });

  test("두 번째 신고자는 firstForTarget=false(별도 행)", async () => {
    const r = await m.createReport({
      reporterId: other,
      targetType: "feed",
      targetId: memberFeedId,
      reason: "spam",
    });
    expect(r).toEqual({ ok: true, created: true, firstForTarget: false });
    expect(
      await prisma.report.count({
        where: { targetType: "feed", targetId: memberFeedId },
      }),
    ).toBe(2);
  });
});

describe("queue · 모더레이션 전이", () => {
  test("listReportQueue: 대상별 그룹·신고 수·사유 집계", async () => {
    // 댓글: reporter(spam) + other(abuse) → 2건/2사유
    await m.createReport({
      reporterId: other,
      targetType: "comment",
      targetId: commentId,
      reason: "abuse",
    });
    const queue = await m.listReportQueue();
    const c = queue.find((q) => q.targetId === commentId);
    expect(c?.targetType).toBe("comment");
    expect(c?.reportCount).toBe(2);
    expect(new Set(c?.reasons)).toEqual(new Set(["spam", "abuse"]));
    expect(c?.preview).toBe("내 댓글");
    expect(c?.slug).toBe("host");
    expect(c?.hidden).toBe(false);
    // 신고 많은 순 정렬: 댓글(2) 먼저
    expect(queue[0]?.targetId).toBe(commentId);
  });

  test("hideTarget: hiddenAt 설정 + pending → resolved", async () => {
    await m.hideTarget("comment", commentId);
    const c = await prisma.comment.findUnique({ where: { id: commentId } });
    expect(c?.hiddenAt).not.toBeNull();
    expect(
      await prisma.report.count({
        where: { targetType: "comment", targetId: commentId, status: "pending" },
      }),
    ).toBe(0);
    expect(
      await prisma.report.count({
        where: {
          targetType: "comment",
          targetId: commentId,
          status: "resolved",
        },
      }),
    ).toBe(2);
    // 숨김된 대상은 큐에서 빠짐
    expect(
      (await m.listReportQueue()).some((q) => q.targetId === commentId),
    ).toBe(false);
  });

  test("이미 숨김된 대상은 신고 거부", async () => {
    const r = await m.createReport({
      reporterId: other,
      targetType: "comment",
      targetId: commentId,
      reason: "spam",
    });
    expect(r).toEqual({ ok: false, error: "이미 가려진 콘텐츠입니다." });
  });

  test("unhideTarget: hiddenAt 해제(되돌리기)", async () => {
    await m.unhideTarget("comment", commentId);
    const c = await prisma.comment.findUnique({ where: { id: commentId } });
    expect(c?.hiddenAt).toBeNull();
  });

  test("dismissReports: pending → dismissed(숨김 없음)", async () => {
    await m.dismissReports("feed", memberFeedId);
    const f = await prisma.feed.findUnique({ where: { id: memberFeedId } });
    expect(f?.hiddenAt).toBeNull();
    expect(
      await prisma.report.count({
        where: { targetType: "feed", targetId: memberFeedId, status: "dismissed" },
      }),
    ).toBe(2); // reporter + other 두 신고 모두 기각
  });

  test("countPendingReportTargets: pending 걸린 고유 대상 수", async () => {
    // 위에서 comment는 resolved, feed는 dismissed → pending 0
    expect(await m.countPendingReportTargets()).toBe(0);
  });
});
