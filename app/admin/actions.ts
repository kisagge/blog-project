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
import { assignFeedSeries } from "@/lib/series";

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
  try {
    const { tags, seriesId, ...feedData } = parsed.data;
    const feed = await prisma.feed.create({ data: feedData });
    await setFeedTags(feed.id, parseTags(tags ?? ""));
    await assignFeedSeries(feed.id, seriesId || null);
  } catch {
    return {
      message: "이미 사용 중인 slug일 수 있습니다.",
      errors: { slug: ["중복되었거나 저장에 실패했습니다."] },
    };
  }
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
    const { tags, seriesId, ...feedData } = parsed.data;
    await prisma.feed.update({ where: { id }, data: feedData });
    await setFeedTags(id, parseTags(tags ?? ""));
    await assignFeedSeries(id, seriesId || null);
  } catch {
    return {
      message: "저장 실패(중복 slug 등).",
      errors: { slug: ["중복되었거나 저장에 실패했습니다."] },
    };
  }
  revalidateFeed();
  redirect("/admin");
}

export async function deleteFeed(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  await prisma.feed.delete({ where: { id } });
  revalidateFeed();
}

export async function setFeedVisibility(
  id: string,
  visibility: "public" | "members" | "private",
) {
  await verifySession();
  await prisma.feed.update({ where: { id }, data: { visibility } });
  revalidateFeed();
}

// 사이트 점검 토글: 공개 사이트(홈+피드)를 비어드민에게 열고/닫는다.
export async function setSitePublic(formData: FormData) {
  await verifySession();
  const enabled = formData.get("enabled") === "true";
  await setPublicEnabled(enabled);
  revalidatePath("/", "layout"); // 홈·피드·점검 페이지 모두 갱신
  revalidatePath("/admin");
}

export async function approveUserAction(formData: FormData) {
  await verifySession();
  await approveUser(String(formData.get("id") ?? ""));
  revalidatePath("/admin", "layout"); // 회원 관리 탭(대기/회원) 모두 갱신
}

export async function rejectUserAction(formData: FormData) {
  await verifySession();
  await rejectUser(
    String(formData.get("id") ?? ""),
    String(formData.get("reason") ?? ""),
  );
  revalidatePath("/admin", "layout");
}

export async function blockUserAction(formData: FormData) {
  await verifySession();
  await blockUser(String(formData.get("id") ?? ""));
  revalidatePath("/admin/members");
}

export async function unblockUserAction(formData: FormData) {
  await verifySession();
  await unblockUser(String(formData.get("id") ?? ""));
  revalidatePath("/admin/members");
}

export async function setAdminNicknameAction(formData: FormData) {
  await verifySession();
  await setAdminNickname(String(formData.get("nickname") ?? ""));
  revalidatePath("/admin/settings");
}
