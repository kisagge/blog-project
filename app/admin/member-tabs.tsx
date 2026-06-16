import Link from "next/link";

const TABS = [
  { key: "pending", href: "/admin/members/pending", label: "가입 대기" },
  { key: "members", href: "/admin/members", label: "회원" },
] as const;

// 회원 관리 탭(가입 대기 / 회원). active·카운트는 각 페이지에서 지정.
export default function MemberTabs({
  active,
  pendingCount,
  memberCount,
}: {
  active: "pending" | "members";
  pendingCount: number;
  memberCount: number;
}) {
  const counts = { pending: pendingCount, members: memberCount };
  return (
    <nav
      aria-label="회원 관리"
      className="mb-6 flex gap-1 border-b border-black/[.08] dark:border-white/[.145]"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {t.label} ({counts[t.key]})
          </Link>
        );
      })}
    </nav>
  );
}
