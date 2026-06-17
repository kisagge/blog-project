"use server";
import { getCommentActor } from "@/lib/comment-actor";
import { createReport, countPendingReportTargets } from "@/lib/reports";
import { ReportSchema } from "@/lib/validation";
import { notifyAdminReport } from "@/lib/notifications";
import { publishReports } from "@/lib/events";

// 신고 제출. 승인 회원/관리자만(차단·비로그인 거부). 본인·중복·관리자 콘텐츠는 createReport에서 방어.
export async function submitReportAction(
  args: { targetType: "comment" | "feed"; targetId: string },
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const actor = await getCommentActor();
  if (!actor) return { error: "로그인이 필요합니다." };
  const parsed = ReportSchema.safeParse({
    reason: formData.get("reason"),
    detail: formData.get("detail") || undefined,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "입력을 확인하세요." };

  const res = await createReport({
    reporterId: actor.userId,
    targetType: args.targetType,
    targetId: args.targetId,
    reason: parsed.data.reason,
    detail: parsed.data.detail,
  });
  if (!res.ok) return { error: res.error };
  // 대상의 첫 신고일 때만 관리자 알림(중복·후속 신고는 무음, 누적은 큐에서 확인).
  // 새 대상이 큐에 들어오면 관리자 라이브 배지도 갱신.
  if (res.firstForTarget) {
    void notifyAdminReport({ targetType: args.targetType }).catch(() => {});
    publishReports(await countPendingReportTargets());
  }
  return { ok: true };
}
