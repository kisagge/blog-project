import { redirect } from "next/navigation";
import { getPublicEnabled } from "@/lib/site-config";

export const metadata = { title: "점검 중" };
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  // 사이트가 다시 공개 상태면 점검 페이지에 머무를 이유가 없으니 홈으로.
  if (await getPublicEnabled()) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        잠시 점검 중입니다
      </h1>
      <p className="max-w-prose text-zinc-600 dark:text-zinc-400">
        더 나은 서비스를 위해 사이트를 점검하고 있습니다. 잠시 후 다시 방문해
        주세요.
      </p>
    </main>
  );
}
