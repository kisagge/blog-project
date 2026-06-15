"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/dal";
import { NicknameSchema } from "@/lib/validation";
import { updateNickname } from "@/lib/users";
import { createMemberSession } from "@/lib/session";

export type AccountState =
  | { errors?: Record<string, string[]>; error?: string; done?: boolean }
  | undefined;

export async function updateNicknameAction(
  _state: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await getSession();
  if (session?.role !== "member") return { error: "로그인이 필요합니다." };

  const parsed = NicknameSchema.safeParse({
    nickname: String(formData.get("nickname") ?? ""),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const nickname = await updateNickname(session.userId, parsed.data.nickname);
  await createMemberSession(session.userId, nickname); // 세션 닉네임 갱신
  revalidatePath("/", "layout"); // 헤더/드로어 닉네임 반영
  return { done: true };
}
