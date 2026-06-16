"use server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { hideTarget, unhideTarget, dismissReports } from "@/lib/reports";

type ReportTargetType = "comment" | "feed";

function revalidate(slug: string) {
  revalidatePath("/admin/reports");
  revalidatePath(`/feed/${slug}`); // 숨김/복구 즉시 공개 화면 반영
}

// 대상 숨김(신고 resolved 처리).
export async function hideTargetAction(
  targetType: ReportTargetType,
  targetId: string,
  slug: string,
) {
  await verifySession();
  await hideTarget(targetType, targetId);
  revalidate(slug);
}

// 숨김 해제(복구).
export async function unhideTargetAction(
  targetType: ReportTargetType,
  targetId: string,
  slug: string,
) {
  await verifySession();
  await unhideTarget(targetType, targetId);
  revalidate(slug);
}

// 신고 기각(숨김 없이 dismissed).
export async function dismissReportsAction(
  targetType: ReportTargetType,
  targetId: string,
  slug: string,
) {
  await verifySession();
  await dismissReports(targetType, targetId);
  revalidate(slug);
}
