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
} from "@/lib/series";

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
    await createSeries(parsed.data);
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
  } catch {
    return { errors: { slug: ["이미 사용 중인 slug입니다."] } };
  }
  revalidateSeries();
  redirect("/admin/series");
}

export async function deleteSeriesAction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteSeries(id);
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
