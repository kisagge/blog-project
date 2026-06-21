import "server-only";
import { prisma } from "@/lib/prisma";

export type AuditTargetType =
  | "feed"
  | "member"
  | "report"
  | "series"
  | "site"
  | "admin";

export type AuditEntry = {
  action: string; // "feed.create" 등 점 표기
  targetType: AuditTargetType;
  targetId?: string | null;
  summary: string; // 작성 시점 사람이 읽는 라벨(대상 삭제돼도 보존)
};

// 거버넌스 액션 감사 기록. best-effort — 절대 throw하지 않아 감사 실패가 액션을 막지 않는다.
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        summary: entry.summary,
      },
    });
  } catch {
    // 감사 기록 실패는 무시(거버넌스 액션 비차단).
  }
}

export const AUDIT_PAGE_SIZE = 30;

// 관리자 감사 로그 목록(최신순, 페이지 단위). getAdminFeedsPage와 동형 반환.
export async function getAuditPage(page: number, pageSize = AUDIT_PAGE_SIZE) {
  const take = pageSize;
  const skip = (Math.max(1, page) - 1) * take;
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.auditLog.count(),
  ]);
  return { items, total, pageSize: take };
}
