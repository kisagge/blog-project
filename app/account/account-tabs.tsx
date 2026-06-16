import Link from "next/link";

const TABS = [
  { key: "info", href: "/account", label: "내 정보" },
  { key: "posts", href: "/account/posts", label: "내 글" },
] as const;

// 내 계정 영역 탭(내 정보 / 내 글). active는 각 페이지에서 지정.
export default function AccountTabs({ active }: { active: "info" | "posts" }) {
  return (
    <nav
      aria-label="내 계정"
      className="flex gap-1 border-b border-black/[.08] dark:border-white/[.145]"
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
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
