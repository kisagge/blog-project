import Link from "next/link";
import type { SeriesContext } from "@/lib/series";

// 글 상세의 시리즈 박스: 시리즈명 링크 + 위치(N편 중 K번째) + 시리즈 내 이전/다음.
export default function SeriesNav({ ctx }: { ctx: SeriesContext }) {
  const { series, total, index, prev, next } = ctx;
  return (
    <nav
      aria-label="시리즈 이동"
      className="mt-10 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]"
    >
      <p className="text-sm text-zinc-500">
        시리즈{" "}
        <Link
          href={`/series/${encodeURIComponent(series.slug)}`}
          className="font-medium text-zinc-800 hover:underline dark:text-zinc-200"
        >
          {series.title}
        </Link>{" "}
        · {total}편 중 {index + 1}번째
      </p>
      {(prev || next) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {prev ? (
            <Link
              href={`/feed/${prev.slug}`}
              className="group flex min-w-0 flex-col gap-0.5 text-sm"
            >
              <span className="text-xs text-zinc-500">← 이전 편</span>
              <span className="truncate group-hover:underline">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/feed/${next.slug}`}
              className="group flex min-w-0 flex-col items-end gap-0.5 text-right text-sm"
            >
              <span className="text-xs text-zinc-500">다음 편 →</span>
              <span className="w-full truncate group-hover:underline">
                {next.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </nav>
  );
}
