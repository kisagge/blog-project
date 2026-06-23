import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeUser, makeFeed } from "@/lib/test-factories";

type FR = typeof import("@/lib/feed-reactions");
let fr: FR;
let prisma: import("@/app/generated/prisma/client").PrismaClient;
let cleanup: () => Promise<void>;
let feedId: string, u1: string, u2: string;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  feedId = (await makeFeed(prisma)).id;
  u1 = (await makeUser(prisma)).id;
  u2 = (await makeUser(prisma)).id;
  fr = await import("@/lib/feed-reactions");
});
afterAll(async () => {
  await cleanup();
});

describe("feed reactions", () => {
  test("토글: 생성/취소 + 이모지별 카운트", async () => {
    expect(await fr.toggleFeedReaction(feedId, u1, "👍")).toEqual({
      reacted: true,
      count: 1,
    });
    expect(await fr.toggleFeedReaction(feedId, u2, "👍")).toEqual({
      reacted: true,
      count: 2,
    });
    // 취소
    expect(await fr.toggleFeedReaction(feedId, u1, "👍")).toEqual({
      reacted: false,
      count: 1,
    });
  });

  test("같은 (글,회원,이모지) 중복 누름은 토글(유니크)", async () => {
    await fr.toggleFeedReaction(feedId, u1, "🎉"); // on
    await fr.toggleFeedReaction(feedId, u1, "🎉"); // off
    const n = await prisma.feedReaction.count({
      where: { feedId, userId: u1, emoji: "🎉" },
    });
    expect(n).toBe(0);
  });

  test("서로 다른 이모지는 독립 카운트 + 세트 순서·내 reacted", async () => {
    await fr.toggleFeedReaction(feedId, u1, "😂"); // u1 😂
    await fr.toggleFeedReaction(feedId, u2, "😮"); // u2 😮
    const list = await fr.getFeedReactionSummary(feedId, u1);
    const byEmoji = Object.fromEntries(list.map((r) => [r.emoji, r]));
    expect(byEmoji["👍"].count).toBe(1); // u2만 남음
    expect(byEmoji["😂"]).toEqual({ emoji: "😂", count: 1, reacted: true }); // u1
    expect(byEmoji["😮"]).toEqual({ emoji: "😮", count: 1, reacted: false }); // u2(내 것 아님)
    // 고정 세트 순서(👍 😂 😮 …), count>0만
    expect(list.map((r) => r.emoji)).toEqual(["👍", "😂", "😮"]);
  });

  test("세트 외 이모지는 거부", async () => {
    await expect(fr.toggleFeedReaction(feedId, u1, "💩")).rejects.toThrow();
  });

  test("비로그인 뷰어는 reacted 모두 false", async () => {
    const list = await fr.getFeedReactionSummary(feedId, undefined);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.reacted === false)).toBe(true);
  });
});
