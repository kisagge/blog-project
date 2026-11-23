import "server-only";
import { prisma } from "@/lib/prisma";
import { startBackgroundTask, stopBackgroundTask } from "@/lib/background-task";
import { DAY_MS, kstDayOf } from "@/lib/kst";

// 계속 쌓이기만 하는 기록의 보존 기간(일). 단일 SQLite·512MB 인스턴스라 무한 증가를 막는다.
// - 조회 기록: 통계·읽기 지표는 최대 30일만 읽고 중복 판정은 당일만 본다 → 넉넉히 180일.
//   글 누적 조회수는 Feed.viewCount에 따로 있어 영향 없음.
// - 알림: 벨은 최근 30개만 보여준다. 읽은 알림 90일, 안 읽은 알림은 놓치지 않게 1년.
// - 감사 로그: 관리 기록이라 1년.
// - 재설정 코드: 유효 3분 + 검증 후 15분 유예라 하루 지나면 쓸 일이 없다.
export const RETENTION_DAYS = {
  views: 180,
  readNotifications: 90,
  unreadNotifications: 365,
  auditLogs: 365,
  resetCodes: 1,
} as const;

export type PruneResult = {
  views: number;
  notifications: number;
  auditLogs: number;
  resetCodes: number;
};

export async function pruneOldRecords(
  now: Date = new Date(),
): Promise<PruneResult> {
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const views = await prisma.view.deleteMany({
    where: {
      entityType: { in: ["feed", "df", "site"] },
      // View.day는 KST "YYYY-MM-DD" 문자열 — (entityType, day) 인덱스를 타도록 같은 형식으로 비교.
      day: { lt: kstDayOf(before(RETENTION_DAYS.views)) },
    },
  });
  const notifications = await prisma.notification.deleteMany({
    where: {
      OR: [
        {
          readAt: { not: null },
          createdAt: { lt: before(RETENTION_DAYS.readNotifications) },
        },
        { createdAt: { lt: before(RETENTION_DAYS.unreadNotifications) } },
      ],
    },
  });
  const auditLogs = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: before(RETENTION_DAYS.auditLogs) } },
  });
  const resetCodes = await prisma.passwordResetCode.deleteMany({
    where: { createdAt: { lt: before(RETENTION_DAYS.resetCodes) } },
  });
  // 대량 삭제 뒤 쿼리 플래너 통계 갱신(SQLite 권장 — 바뀐 게 없으면 거의 비용 없음).
  await prisma.$executeRawUnsafe("PRAGMA optimize");
  return {
    views: views.count,
    notifications: notifications.count,
    auditLogs: auditLogs.count,
    resetCodes: resetCodes.count,
  };
}

async function pruneAndLog(): Promise<void> {
  const r = await pruneOldRecords();
  console.log(
    `[retention] views=${r.views} notifications=${r.notifications} auditLogs=${r.auditLogs} resetCodes=${r.resetCodes}`,
  );
}

// 하루 1회 보존 정리. 배포마다 컨테이너가 재기동되므로 부팅 직후가 아니라 지연 후 첫 실행
// (기동·마이그레이션과 경합 회피).
const TASK = "retention";
export function startRetentionScheduler(
  run: () => Promise<unknown> = pruneAndLog, // 테스트 주입용
  { firstDelayMs = 10 * 60_000, intervalMs = DAY_MS } = {},
): void {
  startBackgroundTask(TASK, run, { firstDelayMs, intervalMs });
}

// 스케줄러 정지(테스트 정리용).
export function stopRetentionScheduler(): void {
  stopBackgroundTask(TASK);
}
