"use server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import {
  hideTarget,
  unhideTarget,
  dismissReports,
  countPendingReportTargets,
} from "@/lib/reports";
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

// 대상 숨김(신고 resolved 처리).
export async function hideTargetAction(
  targetType: string,
  targetId: string,
  slug: string,
) {
  await verifySession();
  if (!isTargetType(targetType)) return;
  await hideTarget(targetType, targetId);
  await logAudit({
    action: "report.hide",
    targetType: "report",
    targetId,
    summary: `신고 대상 숨김(${targetType})`,
  });
  revalidate(slug);
  await broadcastReportCount();
}

// 숨김 해제(복구). pending 수는 불변(신고는 이미 resolved).
export async function unhideTargetAction(
  targetType: string,
  targetId: string,
  slug: string,
) {
  await verifySession();
  if (!isTargetType(targetType)) return;
  await unhideTarget(targetType, targetId);
  await logAudit({
    action: "report.unhide",
    targetType: "report",
    targetId,
    summary: `숨김 해제·복구(${targetType})`,
  });
  revalidate(slug);
}

// 신고 기각(숨김 없이 dismissed).
export async function dismissReportsAction(
  targetType: string,
  targetId: string,
  slug: string,
) {
  await verifySession();
  if (!isTargetType(targetType)) return;
  await dismissReports(targetType, targetId);
  await logAudit({
    action: "report.dismiss",
    targetType: "report",
    targetId,
    summary: `신고 기각(${targetType})`,
  });
  revalidate(slug);
  await broadcastReportCount();
}
