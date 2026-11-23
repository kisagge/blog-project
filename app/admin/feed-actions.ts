"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import type { FormState } from "@/lib/form-state";
import {
  FeedFormSchema,
  feedFormToObject,
  fieldErrors,
} from "@/lib/validation";
import { parseTags, setFeedTags } from "@/lib/tags";
import { decideSchedule } from "@/lib/scheduled";
import { assignFeedSeries } from "@/lib/series";
import { logAudit } from "@/lib/audit";
import { bodyChanged } from "@/lib/feed-dates";
import { restoreRevision, snapshotRevision } from "@/lib/revisions";
import { isVisibility, type Visibility } from "@/lib/visibility";

// 관리자 글 액션: 작성·수정·즉시 발행·삭제·공개범위·이전 버전 복구.

// 감사 요약용: 글 제목(없으면 id 일부).
async function feedLabel(id: string): Promise<string> {
  const f = await prisma.feed.findUnique({
    where: { id },
    select: { title: true },
  });
  return f?.title ?? id.slice(0, 8);
}

export type FeedFormState = FormState;

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
    return { errors: fieldErrors(parsed.error) };
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
      error: "이미 사용 중인 slug일 수 있습니다.",
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
    return { errors: fieldErrors(parsed.error) };
  }
  try {
    const { tags, seriesId, scheduledAt, ...feedData } = parsed.data;
    void scheduledAt; // 예약은 생성 시에만 — 수정에선 무시
    // 제목·요약·본문이 실제로 바뀐 저장이면 바뀌기 직전 버전을 수정 이력으로 스냅샷(같은 트랜잭션 —
    // slug 중복 등으로 저장이 실패하면 이력도 남지 않음). 게시 글이면 수정 시각도 기록
    // (공개범위·태그만 바꾼 저장은 둘 다 제외).
    const prev = await prisma.feed.findUnique({
      where: { id },
      select: { status: true, title: true, content: true, summary: true },
    });
    const changed = !!prev && bodyChanged(prev, feedData);
    const edited = changed && prev?.status === "published";
    await prisma.$transaction(async (tx) => {
      if (changed && prev) await snapshotRevision(tx, id, prev);
      await tx.feed.update({
        where: { id },
        data: edited ? { ...feedData, editedAt: new Date() } : feedData,
      });
    });
    await setFeedTags(id, parseTags(tags ?? ""));
    await assignFeedSeries(id, seriesId || null);
  } catch {
    return {
      error: "저장 실패(중복 slug 등).",
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
    where: { id, authorId: null, status: "draft", scheduledAt: { not: null } },
    data: { status: "published", publishedAt: new Date(), scheduledAt: null },
  });
  if (res.count > 0) {
    await logAudit({
      action: "feed.publish",
      targetType: "feed",
      targetId: id,
      summary: `예약 글 즉시 발행: ${await feedLabel(id)}`,
    });
    revalidateFeed();
  }
}

export async function deleteFeed(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  const label = await feedLabel(id); // 삭제 전에 조회
  await prisma.feed.delete({ where: { id } });
  await logAudit({
    action: "feed.delete",
    targetType: "feed",
    targetId: id,
    summary: `글 삭제: ${label}`,
  });
  revalidateFeed();
}

export async function setFeedVisibility(id: string, visibility: Visibility) {
  await verifySession();
  // 서버 액션 인자는 클라이언트가 임의로 보낼 수 있다 — 허용값 외는 무시.
  if (!isVisibility(visibility)) return;
  await prisma.feed.update({ where: { id }, data: { visibility } });
  await logAudit({
    action: "feed.visibility",
    targetType: "feed",
    targetId: id,
    summary: `공개범위 변경(${visibility}): ${await feedLabel(id)}`,
  });
  revalidateFeed();
}

// 수정 이력의 버전으로 되돌리기(관리자). 현재 버전은 이력으로 먼저 남아 되돌리기도 되돌릴 수 있다.
export async function restoreRevisionAction(revisionId: string) {
  await verifySession();
  const res = await restoreRevision(revisionId);
  if (!res.ok) redirect("/admin/feeds");
  if (res.changed) {
    await logAudit({
      action: "feed.restore",
      targetType: "feed",
      targetId: res.feedId,
      summary: `글 이전 버전으로 되돌림: ${res.title}`,
    });
    revalidateFeed();
  }
  redirect(`/admin/${res.feedId}/revisions?restored=${res.changed ? 1 : 0}`);
}
