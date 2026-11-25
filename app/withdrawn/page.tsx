import Link from "next/link";

export const metadata = { title: "탈퇴 완료", robots: { index: false } };

// 회원 탈퇴 완료 안내(세션은 이미 삭제됨).
export default function WithdrawnPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        탈퇴가 완료되었습니다
      </h1>
      <p className="text-sm text-zinc-500">그동안 이용해 주셔서 감사합니다.</p>
      <Link href="/" className="text-sm underline">
        홈으로
      </Link>
    </main>
  );
}
