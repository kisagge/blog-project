import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeUser } from "@/lib/test-factories";

type RS = typeof import("@/lib/rogue-score");
let rs: RS;
let prisma: import("@/app/generated/prisma/client").PrismaClient;
let cleanup: () => Promise<void>;
let u1: string, u2: string;

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  u1 = (await makeUser(prisma)).id;
  u2 = (await makeUser(prisma)).id;
  rs = await import("@/lib/rogue-score");
});
afterAll(async () => {
  await cleanup();
});

describe("rogue-score", () => {
  test("submit: 점수는 서버가 스탯으로 재계산(depth*100 + kills*25 + gold)", async () => {
    const r = await rs.submitRogueScore({
      userId: u1,
      seed: 42,
      depth: 3,
      kills: 4,
      gold: 17,
    });
    expect(r.score).toBe(3 * 100 + 4 * 25 + 17); // 417
    const row = await prisma.rogueScore.findUnique({ where: { id: r.id } });
    expect(row?.score).toBe(417);
    expect(row?.seed).toBe("42"); // 문자열 보관
  });

  test("submit: 음수·소수는 정규화(floor·clamp)", async () => {
    const r = await rs.submitRogueScore({
      userId: u1,
      seed: 1,
      depth: 2.9,
      kills: -5,
      gold: 10.4,
    });
    expect(r.score).toBe(2 * 100 + 0 * 25 + 10); // depth→2, kills→0, gold→10
  });

  test("leaderboard: 회원별 최고 1건, 점수 내림차순", async () => {
    // u2가 더 높은 점수, u1은 위에서 두 건(최고 417만 노출).
    await rs.submitRogueScore({
      userId: u2,
      seed: 7,
      depth: 6,
      kills: 2,
      gold: 0,
    }); // 650

    const board = await rs.getRogueLeaderboard(10);
    // 회원별 1건씩만.
    const ids = board.map((e) => e.userId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(u1);
    expect(ids).toContain(u2);
    // 점수 내림차순.
    for (let i = 1; i < board.length; i++)
      expect(board[i - 1].score).toBeGreaterThanOrEqual(board[i].score);
    // u2(650)가 u1(417)보다 위.
    expect(ids.indexOf(u2)).toBeLessThan(ids.indexOf(u1));
    // 닉네임 포함.
    expect(board.find((e) => e.userId === u1)?.nickname).toBeTruthy();
  });

  test("getMyBestScore: 회원 최고 점수, 없으면 null", async () => {
    const best = await rs.getMyBestScore(u1);
    expect(best?.score).toBe(417);
    const u3 = (await makeUser(prisma)).id;
    expect(await rs.getMyBestScore(u3)).toBeNull();
  });
});
