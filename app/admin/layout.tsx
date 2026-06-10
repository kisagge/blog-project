import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

export const metadata = { title: "관리자 · BY Playground" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySession(); // 미인증 시 /login redirect

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <div className="mb-8 flex items-center justify-between border-b border-black/[.08] pb-4 dark:border-white/[.145]">
        <nav className="flex gap-4 text-sm">
          <Link href="/admin" className="font-semibold">
            관리자
          </Link>
          <Link
            href="/admin/new"
            className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            새 글
          </Link>
        </nav>
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
