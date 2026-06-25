"use server";
import { z } from "zod";
import { getMemberSession } from "@/lib/dal";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import { submitRogueScore } from "@/lib/rogue-score";

export type SubmitScoreResult =
  | { ok: true; score: number }
  | { skipped: true } // 관리자 등 비회원 — 기록 대상 아님(에러 아님)
  | { error: string };

const schema = z.object({
  seed: z.number().int().finite(),
  depth: z.number().int().min(1).max(10_000),
  kills: z.number().int().min(0).max(100_000),
  gold: z.number().int().min(0).max(10_000_000),
});

// 런 종료(사망) 시 점수 제출. 점수는 서버가 스탯으로 재계산(클라 값 불신).
export async function submitScoreAction(input: {
  seed: number;
  depth: number;
  kills: number;
  gold: number;
}): Promise<SubmitScoreResult> {
  const session = await getMemberSession();
  if (!session) return { skipped: true }; // 관리자/비로그인은 기록하지 않음
  if (!allowAction("rogueScore", session.userId))
    return { error: TOO_MANY_REQUESTS };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "잘못된 점수 데이터입니다." };

  const { score } = await submitRogueScore({
    userId: session.userId,
    ...parsed.data,
  });
  return { ok: true, score };
}
