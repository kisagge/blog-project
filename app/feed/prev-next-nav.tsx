import Link from "next/link";
import type { AdjacentFeed } from "@/lib/feeds";

// 글 상세 본문 푸터의 이전/다음 글 내비. 둘 다 없으면 렌더 안 함.
export default function PrevNextNav({
  prev,
  next,
}: {
  prev: AdjacentFeed | null;
  next: AdjacentFeed | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav
      aria-label="글 이동"
      className="mt-10 grid grid-cols-2 gap-3 border-t border-black/[.08] pt-6 dark:border-white/[.145]"
    >
      {prev ? (
        <Link
          href={`/feed/${prev.slug}`}
          className="group flex min-w-0 flex-col gap-0.5 text-sm"
        >
          <span className="text-xs text-zinc-500">← 이전 글</span>
          <span className="truncate group-hover:underline">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/feed/${next.slug}`}
          className="group flex min-w-0 flex-col items-end gap-0.5 text-right text-sm"
        >
          <span className="text-xs text-zinc-500">다음 글 →</span>
          <span className="w-full truncate group-hover:underline">
            {next.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
