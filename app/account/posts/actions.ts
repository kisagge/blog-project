"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/dal";
import { MemberPostSchema } from "@/lib/validation";
import { saveDraft, publishPost, deleteMyPost } from "@/lib/member-posts";

export type PostFormState =
  | { errors?: Record<string, string[]>; error?: string }
  | undefined;

// 작성기 제출: 버튼의 intent(draft|publish)로 분기. id 있으면 기존 글 수정.
export async function submitPost(
  _state: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const session = await getSession();
  if (session?.role !== "member") return { error: "로그인이 필요합니다." };

  const intent = String(formData.get("intent") ?? "");
  const idValue = String(formData.get("id") ?? "");
  const id = idValue ? idValue : undefined;
  const parsed = MemberPostSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  if (intent === "draft") {
    const r = await saveDraft(session.userId, { id, ...parsed.data });
    if (!r.ok) return { error: r.error };
    revalidatePath("/account");
    redirect("/account");
  }
  if (intent === "publish") {
    const r = await publishPost(session.userId, { id, ...parsed.data });
    if (!r.ok) return { error: r.error };
    revalidatePath("/account");
    revalidatePath("/feed", "layout");
    redirect(`/feed/${r.value.slug}`);
  }
  return { error: "알 수 없는 요청입니다." };
}

export async function deleteMyPostAction(formData: FormData) {
  const session = await getSession();
  if (session?.role !== "member") return;
  await deleteMyPost(session.userId, String(formData.get("id") ?? ""));
  revalidatePath("/account");
  revalidatePath("/feed", "layout");
}
