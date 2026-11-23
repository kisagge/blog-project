"use server";
import { revalidatePath } from "next/cache";
import { getMemberSession } from "@/lib/dal";
import { ProfileSchema, fieldErrors } from "@/lib/validation";
import {
  updateProfile,
  isNicknameTaken,
  NICKNAME_TAKEN_MESSAGE,
} from "@/lib/users";
import { createMemberSession } from "@/lib/session";
import { canUseAsAvatar, deleteOwnedUpload } from "@/lib/uploads";
import { LOGIN_REQUIRED, type FormState } from "@/lib/form-state";

export type AccountState = FormState;

export async function updateProfileAction(
  _state: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await getMemberSession();
  if (!session) return { error: LOGIN_REQUIRED };

  const parsed = ProfileSchema.safeParse({
    nickname: String(formData.get("nickname") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    avatarUrl: String(formData.get("avatarUrl") ?? ""),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (await isNicknameTaken(parsed.data.nickname, session.userId))
    return { errors: { nickname: [NICKNAME_TAKEN_MESSAGE] } };
  // 남의 업로드를 아바타로 지정 → 교체 시 그 파일이 삭제되는 것을 막기 위해 본인 아바타 업로드만 허용.
  if (
    parsed.data.avatarUrl &&
    !(await canUseAsAvatar(session.userId, parsed.data.avatarUrl))
  )
    return {
      errors: {
        avatarUrl: ["직접 업로드한 이미지만 아바타로 쓸 수 있습니다."],
      },
    };

  const { nickname, replacedAvatarUrl } = await updateProfile(
    session.userId,
    parsed.data,
  );
  await createMemberSession(session.userId, nickname, session.sv ?? 0); // 세션 닉네임 갱신(버전 유지)
  // 이전 아바타 파일 정리 — 본인 아바타 업로드 기록과 일치할 때만 삭제.
  if (replacedAvatarUrl)
    await deleteOwnedUpload(replacedAvatarUrl, session.userId, "avatar");
  revalidatePath("/", "layout"); // 헤더/드로어 닉네임 반영
  return { done: true };
}
