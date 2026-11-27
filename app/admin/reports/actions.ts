"use server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import {
  hideTarget,
  unhideTarget,
  dismissReports,
  countPendingReportTargets,
  findReportTarget,
  type ReportTarget,
} from "@/lib/reports";
import { notifyContentModeration } from "@/lib/notifications";
import { publishReports } from "@/lib/events";
import { logAudit } from "@/lib/audit";

type ReportTargetType = "comment" | "feed";

function isTargetType(v: string): v is ReportTargetType {
  return v === "comment" || v === "feed";
}

function revalidate(slug: string) {
  revalidatePath("/admin/reports"); // 대기 탭
  revalidatePath("/admin/reports/hidden"); // 가려진 탭(숨김/복구로 양쪽 변동)
  revalidatePath(`/feed/${slug}`); // 숨김/복구 즉시 공개 화면 반영
}

// pending 대상 수를 관리자 라이브 배지로 전파.
async function broadcastReportCount() {
  publishReports(await countPendingReportTargets());
}

// 숨김·해제 결과를 회원 작성자에게(관리자·탈퇴 회원 콘텐츠는 authorId null → 생략).
async function notifyAuthor(target: ReportTarget, hidden: boolean) {
  if (!target.authorId) return;
  await notifyContentModeration({
    userId: target.authorId,
    targetType: target.targetType,
    targetId: target.targetId,
    slug: target.slug,
    hidden,
  });
}

// 서버 액션 인자는 클라이언트가 임의로 보낼 수 있다 — 대상 종류만 받고, 글 주소·작성자는 DB 값으로.

// 대상 숨김(신고 resolved 처리) + 작성자 알림.
export async function hideTargetAction(targetType: string, targetId: string) {
  await verifySession();
  if (!isTargetType(targetType)) return;
  const target = await hideTarget(targetType, targetId);
  if (!target) return;
  await logAudit({
    action: "report.hide",
    targetType: "report",
    targetId,
    summary: `신고 대상 숨김(${targetType})`,
  });
  revalidate(target.slug);
  await broadcastReportCount();
  await notifyAuthor(target, true);
}

// 숨김 해제(복구) + 작성자 알림. pending 수는 불변(신고는 이미 resolved).
export async function unhideTargetAction(targetType: string, targetId: string) {
  await verifySession();
  if (!isTargetType(targetType)) return;
  const target = await unhideTarget(targetType, targetId);
  if (!target) return;
  await logAudit({
    action: "report.unhide",
    targetType: "report",
    targetId,
    summary: `숨김 해제·복구(${targetType})`,
  });
  revalidate(target.slug);
  await notifyAuthor(target, false);
}

// 신고 기각(숨김 없이 dismissed).
export async function dismissReportsAction(
  targetType: string,
  targetId: string,
) {
  await verifySession();
  if (!isTargetType(targetType)) return;
  const target = await findReportTarget(targetType, targetId);
  await dismissReports(targetType, targetId);
  await logAudit({
    action: "report.dismiss",
    targetType: "report",
    targetId,
    summary: `신고 기각(${targetType})`,
  });
  if (target) revalidate(target.slug);
  await broadcastReportCount();
}
