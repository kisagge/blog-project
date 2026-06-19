"use server";
import { revalidatePath } from "next/cache";
import { getMemberSession } from "@/lib/dal";
import { ProfileSchema } from "@/lib/validation";
import {
  updateProfile,
  isNicknameTaken,
  NICKNAME_TAKEN_MESSAGE,
} from "@/lib/users";
import { createMemberSession } from "@/lib/session";
import { deleteUpload } from "@/lib/save-image";
import type { FormState } from "@/lib/form-state";

export type AccountState = FormState;

export async function updateProfileAction(
  _state: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await getMemberSession();
  if (!session) return { error: "로그인이 필요합니다." };

  const parsed = ProfileSchema.safeParse({
    nickname: String(formData.get("nickname") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    avatarUrl: String(formData.get("avatarUrl") ?? ""),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  if (await isNicknameTaken(parsed.data.nickname, session.userId))
    return { errors: { nickname: [NICKNAME_TAKEN_MESSAGE] } };

  const { nickname, replacedAvatarUrl } = await updateProfile(
    session.userId,
    parsed.data,
  );
  await createMemberSession(session.userId, nickname); // 세션 닉네임 갱신
  if (replacedAvatarUrl) await deleteUpload(replacedAvatarUrl); // 이전 아바타 파일 정리
  revalidatePath("/", "layout"); // 헤더/드로어 닉네임 반영
  return { done: true };
}
