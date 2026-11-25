import Link from "next/link";
import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/dal";
import WithdrawForm from "./withdraw-form";

export const metadata = { title: "회원 탈퇴", robots: { index: false } };

export default async function WithdrawPage() {
  if (!(await getMemberSession())) redirect("/signin");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Link
        href="/account"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← 내 계정
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">회원 탈퇴</h1>
      <section aria-labelledby="withdraw-policy" className="text-sm leading-6">
        <h2 id="withdraw-policy" className="mb-2 font-medium">
          탈퇴하면
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-300">
          <li>
            이메일·비밀번호·닉네임·자기소개·프로필 이미지가 삭제되고, 모든
            기기에서 로그아웃됩니다.
          </li>
          <li>팔로우, 알림, 저장한 글, 임시저장 글이 삭제됩니다.</li>
          <li>
            남긴 댓글·좋아요·반응은 다른 회원의 대화가 끊기지 않도록 “탈퇴한
            회원” 이름으로 남습니다. 내가 쓴 글은 아래에서 함께 삭제할지 고를 수
            있습니다.
          </li>
          <li>같은 이메일로 다시 가입할 수 있습니다.</li>
        </ul>
      </section>
      <WithdrawForm />
    </main>
  );
}
