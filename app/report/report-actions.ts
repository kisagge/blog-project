"use server";
import { LOGIN_REQUIRED } from "@/lib/form-state";
import { getCommentActor } from "@/lib/comment-actor";
import { createReport, countPendingReportTargets } from "@/lib/reports";
import { ReportSchema } from "@/lib/validation";
import { notifyAdminReport } from "@/lib/notifications";
import { publishReports } from "@/lib/events";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import { swallow } from "@/lib/log";
import { getViewerRole } from "@/lib/dal";
import { getReadableCommentFeed, getReadableFeed } from "@/lib/feed-access";

async function canReportTarget(targetType: unknown, targetId: string) {
  if (targetType !== "comment" && targetType !== "feed") return false;
  const role = await getViewerRole();
  const readable =
    targetType === "comment"
      ? await getReadableCommentFeed(targetId, role)
      : await getReadableFeed(targetId, role);
  return readable !== null;
}

// 신고 제출. 승인 회원/관리자만(차단·비로그인 거부). 본인·중복·관리자 콘텐츠는 createReport에서 방어.
export async function submitReportAction(
  args: { targetType: "comment" | "feed"; targetId: string },
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const actor = await getCommentActor();
  if (!actor) return { error: LOGIN_REQUIRED };
  // 신고 남용 방지(회원당). 동일 대상 중복은 createReport의 유니크 제약이 별도 차단.
  if (!allowAction("report", actor.userId)) return { error: TOO_MANY_REQUESTS };
  const parsed = ReportSchema.safeParse({
    reason: formData.get("reason"),
    detail: formData.get("detail") || undefined,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "입력을 확인하세요." };

  // 서버 액션 인자는 임의 값일 수 있다 — 대상 종류를 확인하고, 신고자가 실제로 볼 수 있는 대상만.
  // (잘못된 종류는 매번 '첫 신고'로 관리자 알림을 보내고 처리할 수 없는 신고로 남았다.)
  if (!(await canReportTarget(args.targetType, args.targetId)))
    return { error: "신고할 수 없는 대상입니다." };

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
    void notifyAdminReport({ targetType: args.targetType }).catch(
      swallow("notify:admin-report"),
    );
    publishReports(await countPendingReportTargets());
  }
  return { ok: true };
}
