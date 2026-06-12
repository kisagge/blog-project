import { redirect } from "next/navigation";
import { getResetCookie } from "@/lib/reset-token";
import VerifyForm from "./verify-form";

export const metadata = { title: "코드 확인 · BY Playground" };

export default async function VerifyPage() {
  const cookie = await getResetCookie();
  if (!cookie) redirect("/forgot-password");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">인증 코드 입력</h1>
      <p className="-mt-4 text-center text-sm text-zinc-500">
        <span className="font-medium">{cookie.email}</span> 로 보낸 6자리 코드를
        입력하세요.
      </p>
      <VerifyForm expiresAt={cookie.expiresAt} />
    </main>
  );
}
