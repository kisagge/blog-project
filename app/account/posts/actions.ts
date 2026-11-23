"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMemberSession } from "@/lib/dal";
import { MemberPostSchema, fieldErrors } from "@/lib/validation";
import { saveDraft, publishPost, deleteMyPost } from "@/lib/member-posts";
import { LOGIN_REQUIRED, type FormState } from "@/lib/form-state";

export type PostFormState = FormState;

// 게시 글이 바뀌면: 내 계정(프로필 글 목록) + 피드 목록·상세.
function revalidatePublished() {
  revalidatePath("/account");
  revalidatePath("/feed", "layout");
}

// 작성기 제출: 버튼의 intent(draft|publish)로 분기. id 있으면 기존 글 수정.
export async function submitPost(
  _state: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const session = await getMemberSession();
  if (!session) return { error: LOGIN_REQUIRED };

  const intent = String(formData.get("intent") ?? "");
  const idValue = String(formData.get("id") ?? "");
  const id = idValue ? idValue : undefined;
  const parsed = MemberPostSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
    tags: String(formData.get("tags") ?? ""),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (intent === "draft") {
    const r = await saveDraft(session.userId, { id, ...parsed.data });
    if (!r.ok) return { error: r.error };
    revalidatePath("/account/posts");
    redirect("/account/posts"); // 임시저장 목록이 있는 '내 글' 탭(프로필 탭 /account가 아니라)
  }
  if (intent === "publish") {
    const r = await publishPost(session.userId, { id, ...parsed.data });
    if (!r.ok) return { error: r.error };
    revalidatePublished();
    redirect(`/feed/${r.value.slug}`);
  }
  return { error: "알 수 없는 요청입니다." };
}

export async function deleteMyPostAction(formData: FormData) {
  const session = await getMemberSession();
  if (!session) return;
  await deleteMyPost(session.userId, String(formData.get("id") ?? ""));
  revalidatePublished();
}
