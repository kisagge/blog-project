import { redirect } from "next/navigation";
import { getResetCookie } from "@/lib/reset-token";
import ResetForm from "./reset-form";

export const metadata = { title: "새 비밀번호 · BY Playground" };

export default async function ResetPage() {
  const cookie = await getResetCookie();
  if (!cookie || !cookie.verified) redirect("/forgot-password");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">
        새 비밀번호 설정
      </h1>
      <ResetForm />
    </main>
  );
}
