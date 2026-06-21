"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { SeriesSchema } from "@/lib/validation";
import {
  createSeries,
  updateSeries,
  deleteSeries,
  reorderSeries,
  removeFromSeries,
  getSeriesById,
} from "@/lib/series";
import { logAudit } from "@/lib/audit";

export type SeriesFormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

function revalidateSeries() {
  revalidatePath("/admin/series");
  revalidatePath("/series", "layout");
  revalidatePath("/feed", "layout"); // 글 상세 시리즈 박스
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
  const parsed = SeriesSchema.safeParse(toInput(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  try {
    const s = await createSeries(parsed.data);
    await logAudit({
      action: "series.create",
      targetType: "series",
      targetId: s.id,
      summary: `시리즈 생성: ${parsed.data.title}`,
    });
  } catch {
    return { errors: { slug: ["이미 사용 중인 slug입니다."] } };
  }
  revalidateSeries();
  redirect("/admin/series");
}

export async function updateSeriesAction(
  id: string,
  _state: SeriesFormState,
  formData: FormData,
): Promise<SeriesFormState> {
  await verifySession();
  const parsed = SeriesSchema.safeParse(toInput(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  try {
    await updateSeries(id, parsed.data);
    await logAudit({
      action: "series.update",
      targetType: "series",
      targetId: id,
      summary: `시리즈 수정: ${parsed.data.title}`,
    });
  } catch {
    return { errors: { slug: ["이미 사용 중인 slug입니다."] } };
  }
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
