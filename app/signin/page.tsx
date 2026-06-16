import SigninForm from "./signin-form";
import { turnstileSiteKey } from "@/lib/turnstile";

export const metadata = { title: "로그인" };

export default async function SigninPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
      {reset === "1" && (
        <p className="-mt-4 text-sm text-green-600">
          비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.
        </p>
      )}
      <SigninForm siteKey={turnstileSiteKey()} />
    </main>
  );
}
