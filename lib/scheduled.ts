import "server-only";
import { prisma } from "@/lib/prisma";
import { rssCache } from "@/lib/rss";
import { kstWallClockToUtc } from "@/lib/kst";
import { startBackgroundTask, stopBackgroundTask } from "@/lib/background-task";

// 예약 발행 도래분 일괄 게시. status="draft" + scheduledAt<=now(=null 제외 → 회원 임시저장 무관)을
// published로 전환하고 publishedAt 기록·scheduledAt 비움. 발행 건수 반환(DB 오류는 throw — 스케줄러가 swallow로 흡수).
export async function publishDueFeeds(now: Date = new Date()): Promise<number> {
  const res = await prisma.feed.updateMany({
    where: { status: "draft", scheduledAt: { lte: now } },
    data: { status: "published", publishedAt: now, scheduledAt: null },
  });
  if (res.count > 0) rssCache.clear(); // 새로 발행된 글을 RSS에 바로 반영
  return res.count;
}

// 앱 내부 예약 발행 스케줄러. instrumentation에서 부팅 시 1회 시작 → 외부 cron·CRON_SECRET 없이 정시 발행.
// 부팅 즉시 1회(재기동 동안 도래한 예약분을 바로 게시) 후 2분마다.
const TASK = "publish-due";
export function startPublishScheduler(
  intervalMs = 120_000, // 2분
  run: () => Promise<unknown> = publishDueFeeds, // 테스트 주입용
): void {
  startBackgroundTask(TASK, run, { firstDelayMs: 0, intervalMs });
}

// 스케줄러 정지(테스트 정리용).
export function stopPublishScheduler(): void {
  stopBackgroundTask(TASK);
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
