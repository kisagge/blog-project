import Link from "next/link";
import { getSeriesWithCounts } from "@/lib/series";
import { getViewerRole } from "@/lib/dal";

export const metadata = {
  title: "시리즈",
  description: "연재 글을 모아보기",
  alternates: { canonical: "/series" },
};

// 런타임 DB 조회.
export const dynamic = "force-dynamic";

export default async function SeriesIndexPage() {
  const series = await getSeriesWithCounts(await getViewerRole());

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">시리즈</h1>
      {series.length === 0 ? (
        <p className="text-zinc-500">아직 시리즈가 없습니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {series.map((s) => (
            <li key={s.slug} className="py-3">
              <Link
                href={`/series/${encodeURIComponent(s.slug)}`}
                className="group flex items-center justify-between gap-3"
              >
                <span className="truncate font-medium group-hover:underline">
                  {s.title}
                </span>
                <span className="shrink-0 text-sm text-zinc-500 tabular-nums">
                  {s.count}편
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
