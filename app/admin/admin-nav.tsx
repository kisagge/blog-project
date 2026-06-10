"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/feeds", label: "글" },
  { href: "/admin/members", label: "회원" },
  { href: "/admin/settings", label: "설정" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-4 text-sm">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(tab.href);
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
          </Link>
        );
      })}
    </nav>
  );
}
