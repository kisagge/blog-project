"use server";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { hideTarget, unhideTarget, dismissReports } from "@/lib/reports";

type ReportTargetType = "comment" | "feed";

function isTargetType(v: string): v is ReportTargetType {
  return v === "comment" || v === "feed";
}

function revalidate(slug: string) {
  revalidatePath("/admin/reports");
  revalidatePath(`/feed/${slug}`); // 숨김/복구 즉시 공개 화면 반영
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
  revalidate(slug);
}

// 숨김 해제(복구).
export async function unhideTargetAction(
  targetType: string,
  targetId: string,
  slug: string,
) {
  await verifySession();
  if (!isTargetType(targetType)) return;
  await unhideTarget(targetType, targetId);
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
  revalidate(slug);
}
