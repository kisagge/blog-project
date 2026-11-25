"use server";
import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/dal";
import { deleteSession } from "@/lib/session";
import { verifyMemberPassword } from "@/lib/users";
import { withdrawMember } from "@/lib/withdrawal";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import { LOGIN_REQUIRED, type FormState } from "@/lib/form-state";

export type WithdrawState = FormState;

// 회원 탈퇴: 확인 체크 + 비밀번호 재확인(회원당 요청 제한) → 탈퇴 → 로그아웃 → 완료 화면.
export async function withdrawAction(
  _state: WithdrawState,
  formData: FormData,
): Promise<WithdrawState> {
  const session = await getMemberSession();
  if (!session) return { error: LOGIN_REQUIRED };
  if (formData.get("confirm") !== "on")
    return { errors: { confirm: ["탈퇴 안내를 확인해 주세요."] } };
  if (!allowAction("withdraw", session.userId))
    return { error: TOO_MANY_REQUESTS };
  const password = String(formData.get("password") ?? "");
  if (!(await verifyMemberPassword(session.userId, password)))
    return { errors: { password: ["비밀번호가 올바르지 않습니다."] } };

  const res = await withdrawMember(session.userId, {
    deletePosts: formData.get("deletePosts") === "on",
  });
  if (!res.ok) return { error: res.error };
  await deleteSession();
  redirect("/withdrawn");
}
