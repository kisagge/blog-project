"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/feeds", label: "글" },
  { href: "/admin/members", label: "회원" },
  { href: "/admin/reports", label: "신고" },
  { href: "/admin/df", label: "던파" },
  { href: "/admin/settings", label: "설정" },
];

export default function AdminNav({
  pendingReports = 0,
}: {
  pendingReports?: number;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-4 text-sm">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(tab.href);
        const badge = tab.href === "/admin/reports" && pendingReports > 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "font-semibold"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            }
          >
            {tab.label}
            {badge && (
              <span
                aria-label={`미처리 신고 ${pendingReports}건`}
                className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
              >
                {pendingReports}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
