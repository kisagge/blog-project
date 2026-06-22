import "server-only";
import { prisma } from "@/lib/prisma";
import { kstWallClockToUtc } from "@/lib/kst";

// 예약 발행 도래분 일괄 게시. status="draft" + scheduledAt<=now(=null 제외 → 회원 임시저장 무관)을
// published로 전환하고 publishedAt 기록·scheduledAt 비움. 발행 건수 반환(절대 throw 안 함 가정 호출부).
export async function publishDueFeeds(now: Date = new Date()): Promise<number> {
  const res = await prisma.feed.updateMany({
    where: { status: "draft", scheduledAt: { lte: now } },
    data: { status: "published", publishedAt: now, scheduledAt: null },
  });
  return res.count;
}

// 작성 폼의 scheduledAt 입력(KST 벽시계 문자열) 해석. 생성 액션 공용(순수, 테스트용).
// - 빈값 → { kind:"immediate" }(현행 즉시 발행)
// - 미래 유효 → { kind:"scheduled", at }
// - 무효/과거 → { kind:"error", message }
export type ScheduleDecision =
  | { kind: "immediate" }
  | { kind: "scheduled"; at: Date }
  | { kind: "error"; message: string };

export function decideSchedule(
  raw: string | undefined,
  now: Date = new Date(),
): ScheduleDecision {
  const s = (raw ?? "").trim();
  if (!s) return { kind: "immediate" };
  const at = kstWallClockToUtc(s);
  if (!at)
    return { kind: "error", message: "예약 시각 형식이 올바르지 않습니다." };
  if (at.getTime() <= now.getTime())
    return { kind: "error", message: "예약 시각은 미래여야 합니다." };
  return { kind: "scheduled", at };
}
