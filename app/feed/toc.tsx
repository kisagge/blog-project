import type { TocItem } from "@/lib/content";

// 글 상단 접이식 목차. 헤딩 2개 미만이면 표시 안 함. 네이티브 앵커 스크롤(JS 불필요).
export default function Toc({ items }: { items: TocItem[] }) {
  if (items.length < 2) return null;
  return (
    <details
      open
      className="mb-8 rounded-lg border border-black/[.06] bg-black/[.02] p-3 dark:border-white/[.1] dark:bg-white/[.03]"
    >
      <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-300">
        목차
      </summary>
      <nav aria-label="목차" className="mt-2">
        <ul className="flex flex-col gap-1 text-sm">
          {items.map((item) => (
            <li key={item.slug} className={item.depth >= 3 ? "ml-4" : ""}>
              <a
                href={`#${item.slug}`}
                className="text-zinc-500 hover:underline dark:text-zinc-400"
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
