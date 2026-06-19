import Link from "next/link";
import type { RelatedFeed } from "@/lib/feeds";

// 글 상세 하단 관련 글(같은 태그 공유). 비면 렌더 안 함.
export default function RelatedFeeds({ items }: { items: RelatedFeed[] }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="related-feeds"
      className="mt-10 border-t border-black/[.08] pt-6 dark:border-white/[.145]"
    >
      <h2
        id="related-feeds"
        className="mb-3 text-lg font-semibold tracking-tight"
      >
        관련 글
      </h2>
      <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
        {items.map((f) => (
          <li key={f.slug} className="py-2">
            <Link
              href={`/feed/${f.slug}`}
              className="group flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate group-hover:underline">{f.title}</span>
              <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
                조회 {f.viewCount.toLocaleString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
