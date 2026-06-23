import "server-only";
import { prisma } from "@/lib/prisma";
import { kstWallClockToUtc } from "@/lib/kst";
import { swallow } from "@/lib/log";

// 예약 발행 도래분 일괄 게시. status="draft" + scheduledAt<=now(=null 제외 → 회원 임시저장 무관)을
// published로 전환하고 publishedAt 기록·scheduledAt 비움. 발행 건수 반환(절대 throw 안 함 가정 호출부).
export async function publishDueFeeds(now: Date = new Date()): Promise<number> {
  const res = await prisma.feed.updateMany({
    where: { status: "draft", scheduledAt: { lte: now } },
    data: { status: "published", publishedAt: now, scheduledAt: null },
  });
  return res.count;
}

// 앱 내부 예약 발행 스케줄러. 컨테이너가 항상 떠 있으므로 instrumentation에서 부팅 시 1회 시작 →
// 외부 cron(GitHub/호스트)·CRON_SECRET 없이 정시 발행. 단일 프로세스(next start) 전제라 인터벌 1개.
const g = globalThis as { __pubSched?: ReturnType<typeof setInterval> };
export function startPublishScheduler(
  intervalMs = 120_000, // 2분
  run: () => Promise<unknown> = publishDueFeeds, // 테스트 주입용
): void {
  if (g.__pubSched) return; // 중복 시작 방지(register 재호출·HMR)
  void run().catch(swallow("scheduler:publish-due")); // 부팅 즉시 1회
  g.__pubSched = setInterval(
    () => void run().catch(swallow("scheduler:publish-due")),
    intervalMs,
  );
  g.__pubSched.unref?.(); // 테스트/종료 시 프로세스 잔류 방지
}

// 스케줄러 정지(테스트 정리용).
export function stopPublishScheduler(): void {
  if (g.__pubSched) {
    clearInterval(g.__pubSched);
    g.__pubSched = undefined;
  }
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
