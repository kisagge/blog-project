"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { setPublicEnabled } from "@/lib/site-config";
import { setAdminNickname } from "@/lib/comment-actor";
import { approveUser, blockUser, unblockUser, rejectUser } from "@/lib/users";
import { FeedFormSchema, feedFormToObject } from "@/lib/validation";
import { parseTags, setFeedTags } from "@/lib/tags";
import { decideSchedule } from "@/lib/scheduled";
import { assignFeedSeries } from "@/lib/series";
import { logAudit } from "@/lib/audit";

// 감사 요약용: 회원 닉네임(없으면 id 일부).
async function memberLabel(id: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id },
    select: { nickname: true },
  });
  return u?.nickname ?? id.slice(0, 8);
}

export type FeedFormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

function revalidateFeed() {
  revalidatePath("/feed", "layout"); // 목록 + 모든 상세
  revalidatePath("/series", "layout"); // 시리즈 목록·페이지(배정 변동 반영)
  revalidatePath("/admin");
}

export async function createFeed(
  _state: FeedFormState,
  formData: FormData,
): Promise<FeedFormState> {
  await verifySession();
  const parsed = FeedFormSchema.safeParse(feedFormToObject(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  // 예약 발행은 생성 시에만. 미래면 draft+scheduledAt, 과거/무효면 폼 에러, 빈값이면 즉시.
  const { tags, seriesId, scheduledAt, ...feedData } = parsed.data;
  const sched = decideSchedule(scheduledAt);
  if (sched.kind === "error") {
    return { errors: { scheduledAt: [sched.message] } };
  }
  let createdId: string | undefined;
  try {
    const data =
      sched.kind === "scheduled"
        ? { ...feedData, status: "draft", scheduledAt: sched.at }
        : feedData;
    const feed = await prisma.feed.create({ data });
    createdId = feed.id;
    await setFeedTags(feed.id, parseTags(tags ?? ""));
    await assignFeedSeries(feed.id, seriesId || null);
  } catch {
    return {
      message: "이미 사용 중인 slug일 수 있습니다.",
      errors: { slug: ["중복되었거나 저장에 실패했습니다."] },
    };
  }
  await logAudit({
    action: "feed.create",
    targetType: "feed",
    targetId: createdId,
    summary:
      sched.kind === "scheduled"
        ? `글 예약 작성: ${parsed.data.title} (${parsed.data.scheduledAt})`
        : `글 작성: ${parsed.data.title}`,
  });
  revalidateFeed();
  redirect("/admin");
}

export async function updateFeed(
  id: string,
  _state: FeedFormState,
  formData: FormData,
): Promise<FeedFormState> {
  await verifySession();
  const parsed = FeedFormSchema.safeParse(feedFormToObject(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { tags, seriesId, scheduledAt, ...feedData } = parsed.data;
    void scheduledAt; // 예약은 생성 시에만 — 수정에선 무시
    await prisma.feed.update({ where: { id }, data: feedData });
    await setFeedTags(id, parseTags(tags ?? ""));
    await assignFeedSeries(id, seriesId || null);
  } catch {
    return {
      message: "저장 실패(중복 slug 등).",
      errors: { slug: ["중복되었거나 저장에 실패했습니다."] },
    };
  }
  await logAudit({
    action: "feed.update",
    targetType: "feed",
    targetId: id,
    summary: `글 수정: ${parsed.data.title}`,
  });
  revalidateFeed();
  redirect("/admin");
}

// 예약 글을 지금 즉시 발행(관리자 목록의 안전밸브). 관리자 예약 초안만 전환.
export async function publishNowAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  const res = await prisma.feed.updateMany({
    where: { id, authorId: null, status: "draft" },
    data: { status: "published", publishedAt: new Date(), scheduledAt: null },
  });
  if (res.count > 0) {
    const feed = await prisma.feed.findUnique({
      where: { id },
      select: { title: true },
    });
    await logAudit({
      action: "feed.publish",
      targetType: "feed",
      targetId: id,
      summary: `예약 글 즉시 발행: ${feed?.title ?? id.slice(0, 8)}`,
    });
    revalidateFeed();
  }
}

export async function deleteFeed(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  const feed = await prisma.feed.findUnique({
    where: { id },
    select: { title: true },
  });
  await prisma.feed.delete({ where: { id } });
  await logAudit({
    action: "feed.delete",
    targetType: "feed",
    targetId: id,
    summary: `글 삭제: ${feed?.title ?? id.slice(0, 8)}`,
  });
  revalidateFeed();
}

export async function setFeedVisibility(
  id: string,
  visibility: "public" | "members" | "private",
) {
  await verifySession();
  await prisma.feed.update({ where: { id }, data: { visibility } });
  const feed = await prisma.feed.findUnique({
    where: { id },
    select: { title: true },
  });
  await logAudit({
    action: "feed.visibility",
    targetType: "feed",
    targetId: id,
    summary: `공개범위 변경(${visibility}): ${feed?.title ?? id.slice(0, 8)}`,
  });
  revalidateFeed();
}

// 사이트 점검 토글: 공개 사이트(홈+피드)를 비어드민에게 열고/닫는다.
export async function setSitePublic(formData: FormData) {
  await verifySession();
  const enabled = formData.get("enabled") === "true";
  await setPublicEnabled(enabled);
  await logAudit({
    action: "site.public",
    targetType: "site",
    summary: enabled ? "사이트 공개(점검 해제)" : "사이트 점검 모드 전환",
  });
  revalidatePath("/", "layout"); // 홈·피드·점검 페이지 모두 갱신
  revalidatePath("/admin");
}

export async function approveUserAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  await approveUser(id);
  await logAudit({
    action: "member.approve",
    targetType: "member",
    targetId: id,
    summary: `회원 승인: ${await memberLabel(id)}`,
  });
  revalidatePath("/admin", "layout"); // 회원 관리 탭(대기/회원) 모두 갱신
}

export async function rejectUserAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "");
  await rejectUser(id, reason);
  await logAudit({
    action: "member.reject",
    targetType: "member",
    targetId: id,
    summary: `회원 거절: ${await memberLabel(id)}${reason ? ` (${reason})` : ""}`,
  });
  revalidatePath("/admin", "layout");
}

export async function blockUserAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  await blockUser(id);
  await logAudit({
    action: "member.block",
    targetType: "member",
    targetId: id,
    summary: `회원 차단: ${await memberLabel(id)}`,
  });
  revalidatePath("/admin/members");
}

export async function unblockUserAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  await unblockUser(id);
  await logAudit({
    action: "member.unblock",
    targetType: "member",
    targetId: id,
    summary: `회원 차단 해제: ${await memberLabel(id)}`,
  });
  revalidatePath("/admin/members");
}

export async function setAdminNicknameAction(formData: FormData) {
  await verifySession();
  const nickname = String(formData.get("nickname") ?? "");
  await setAdminNickname(nickname);
  await logAudit({
    action: "admin.nickname",
    targetType: "admin",
    summary: `관리자 닉네임 변경: ${nickname.trim() || "(기본값)"}`,
  });
  revalidatePath("/admin/settings");
}
