import Link from "next/link";

export type LinkTab = { href: string; label: string; active: boolean };

// 페이지 간 이동 탭(밑줄형). 탭마다 별도 주소라 ARIA tab이 아닌 nav + aria-current로 현재 위치 표시.
export default function LinkTabs({
  label,
  tabs,
  className = "",
}: {
  label: string;
  tabs: LinkTab[];
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={`flex gap-1 border-b border-black/[.08] dark:border-white/[.145] ${className}`.trim()}
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            t.active
              ? "border-foreground text-foreground"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
