import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";
import LoginForm from "./login-form";

export const metadata = { title: "로그인 · BY Playground" };

export default async function LoginPage() {
  const session = await getSession();
  if (session?.admin) redirect("/admin");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">관리자 로그인</h1>
      <LoginForm />
    </main>
  );
}
