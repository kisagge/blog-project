import Link from "next/link";

const TABS = [
  { key: "queue", href: "/admin/reports", label: "대기 중" },
  { key: "hidden", href: "/admin/reports/hidden", label: "가려진 콘텐츠" },
] as const;

// 신고 관리 탭(대기 중 / 가려진 콘텐츠). active·카운트는 각 페이지에서 지정.
export default function ReportTabs({
  active,
  queueCount,
  hiddenCount,
}: {
  active: "queue" | "hidden";
  queueCount: number;
  hiddenCount: number;
}) {
  const counts = { queue: queueCount, hidden: hiddenCount };
  return (
    <nav
      aria-label="신고 관리"
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
