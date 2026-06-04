"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { FeedFormSchema, feedFormToObject } from "@/lib/validation";

export type FeedFormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

function revalidateFeed() {
  revalidatePath("/feed", "layout"); // 목록 + 모든 상세
  revalidatePath("/admin");
}

export async function createFeed(_state: FeedFormState, formData: FormData): Promise<FeedFormState> {
  await verifySession();
  const parsed = FeedFormSchema.safeParse(feedFormToObject(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  try {
    await prisma.feed.create({ data: parsed.data });
  } catch (e) {
    return { message: "이미 사용 중인 slug일 수 있습니다.", errors: { slug: ["중복되었거나 저장에 실패했습니다."] } };
  }
  revalidateFeed();
  redirect("/admin");
}

export async function updateFeed(id: string, _state: FeedFormState, formData: FormData): Promise<FeedFormState> {
  await verifySession();
  const parsed = FeedFormSchema.safeParse(feedFormToObject(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  try {
    await prisma.feed.update({ where: { id }, data: parsed.data });
  } catch (e) {
    return { message: "저장 실패(중복 slug 등).", errors: { slug: ["중복되었거나 저장에 실패했습니다."] } };
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

export async function togglePublished(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  const feed = await prisma.feed.findUnique({ where: { id }, select: { published: true } });
  if (!feed) return;
  await prisma.feed.update({ where: { id }, data: { published: !feed.published } });
  revalidateFeed();
}
