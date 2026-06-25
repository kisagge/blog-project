import { prisma } from "@/lib/prisma";
import { scoreFromStats } from "@/lib/game/rogue/score";

export type ScoreInput = {
  userId: string;
  seed: number;
  depth: number;
  kills: number;
  gold: number;
};

export type LeaderEntry = {
  userId: string;
  nickname: string;
  depth: number;
  score: number;
  kills: number;
  createdAt: Date;
};

// 런 결과 기록. 점수는 서버가 스탯으로 재계산(클라 제출 점수 신뢰 안 함).
export async function submitRogueScore(
  input: ScoreInput,
): Promise<{ id: string; score: number }> {
  const depth = Math.max(1, Math.floor(input.depth));
  const kills = Math.max(0, Math.floor(input.kills));
  const gold = Math.max(0, Math.floor(input.gold));
  const score = scoreFromStats(depth, kills, gold);
  const row = await prisma.rogueScore.create({
    data: {
      userId: input.userId,
      seed: String(input.seed),
      depth,
      score,
      kills,
    },
    select: { id: true },
  });
  return { id: row.id, score };
}

// 리더보드: 회원별 최고 점수 1건(같은 회원 중복 제거), 점수 내림차순.
export async function getRogueLeaderboard(limit = 20): Promise<LeaderEntry[]> {
  // 상위 런을 넉넉히 가져와 회원별 첫(=최고) 것만 추린다. 취미 규모라 충분.
  const rows = await prisma.rogueScore.findMany({
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: 200,
    select: {
      userId: true,
      depth: true,
      score: true,
      kills: true,
      createdAt: true,
      user: { select: { nickname: true } },
    },
  });
  const seen = new Set<string>();
  const out: LeaderEntry[] = [];
  for (const r of rows) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    out.push({
      userId: r.userId,
      nickname: r.user.nickname,
      depth: r.depth,
      score: r.score,
      kills: r.kills,
      createdAt: r.createdAt,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// 한 회원의 최고 점수(개인 기록 표시용). 없으면 null.
export async function getMyBestScore(
  userId: string,
): Promise<{ depth: number; score: number; kills: number } | null> {
  const r = await prisma.rogueScore.findFirst({
    where: { userId },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    select: { depth: true, score: true, kills: true },
  });
  return r;
}
