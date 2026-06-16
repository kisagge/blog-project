"use server";
import { revalidatePath } from "next/cache";
import { getMemberSession } from "@/lib/dal";
import { NicknameSchema } from "@/lib/validation";
import {
  updateNickname,
  isNicknameTaken,
  NICKNAME_TAKEN_MESSAGE,
} from "@/lib/users";
import { createMemberSession } from "@/lib/session";
import type { FormState } from "@/lib/form-state";

export type AccountState = FormState;

export async function updateNicknameAction(
  _state: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await getMemberSession();
  if (!session) return { error: "로그인이 필요합니다." };

  const parsed = NicknameSchema.safeParse({
    nickname: String(formData.get("nickname") ?? ""),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  if (await isNicknameTaken(parsed.data.nickname, session.userId))
    return { errors: { nickname: [NICKNAME_TAKEN_MESSAGE] } };

  const nickname = await updateNickname(session.userId, parsed.data.nickname);
  await createMemberSession(session.userId, nickname); // 세션 닉네임 갱신
  revalidatePath("/", "layout"); // 헤더/드로어 닉네임 반영
  return { done: true };
}
