"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { rssCache } from "@/lib/rss";
import { SeriesSchema, fieldErrors } from "@/lib/validation";
import {
  createSeries,
  updateSeries,
  deleteSeries,
  reorderSeries,
  removeFromSeries,
  getSeriesById,
} from "@/lib/series";
import { logAudit } from "@/lib/audit";
import type { FormState } from "@/lib/form-state";

export type SeriesFormState = FormState;

function revalidateSeries() {
  revalidatePath("/admin/series");
  revalidatePath("/series", "layout");
  revalidatePath("/feed", "layout"); // 글 상세 시리즈 박스
  rssCache.clear(); // 시리즈 RSS
}

function toInput(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

export async function createSeriesAction(
  _state: SeriesFormState,
  formData: FormData,
): Promise<SeriesFormState> {
  await verifySession();
  const values = toInput(formData);
  const parsed = SeriesSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  let createdId: string | undefined;
  try {
    const s = await createSeries(parsed.data);
    createdId = s.id;
  } catch {
    return { errors: { slug: ["이미 사용 중인 slug입니다."] }, values };
  }
  await logAudit({
    action: "series.create",
    targetType: "series",
    targetId: createdId,
    summary: `시리즈 생성: ${parsed.data.title}`,
  });
  revalidateSeries();
  redirect("/admin/series");
}

export async function updateSeriesAction(
  id: string,
  _state: SeriesFormState,
  formData: FormData,
): Promise<SeriesFormState> {
  await verifySession();
  const values = toInput(formData);
  const parsed = SeriesSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  try {
    await updateSeries(id, parsed.data);
  } catch {
    return { errors: { slug: ["이미 사용 중인 slug입니다."] }, values };
  }
  await logAudit({
    action: "series.update",
    targetType: "series",
    targetId: id,
    summary: `시리즈 수정: ${parsed.data.title}`,
  });
  revalidateSeries();
  redirect("/admin/series");
}

export async function deleteSeriesAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (id) {
    const s = await getSeriesById(id);
    await deleteSeries(id);
    await logAudit({
      action: "series.delete",
      targetType: "series",
      targetId: id,
      summary: `시리즈 삭제: ${s?.title ?? id.slice(0, 8)}`,
    });
  }
  revalidateSeries();
  redirect("/admin/series");
}

export async function reorderSeriesAction(
  seriesId: string,
  orderedFeedIds: string[],
) {
  await verifySession();
  await reorderSeries(seriesId, orderedFeedIds);
  revalidateSeries();
}

export async function removeFromSeriesAction(feedId: string) {
  await verifySession();
  await removeFromSeries(feedId);
  revalidateSeries();
}
