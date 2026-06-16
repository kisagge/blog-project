import { verifySession } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
import { countPendingReportTargets } from "@/lib/reports";
import AdminNav from "./admin-nav";

export const metadata = { title: "관리자" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySession(); // 미인증 시 /login redirect
  const pendingReports = await countPendingReportTargets();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <div className="mb-8 flex items-center justify-between border-b border-black/[.08] pb-4 dark:border-white/[.145]">
        <AdminNav pendingReports={pendingReports} />
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            로그아웃
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
