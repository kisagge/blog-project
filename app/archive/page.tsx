import Link from "next/link";
import { getArchiveFeeds } from "@/lib/feeds";
import { getViewerRole } from "@/lib/dal";
import { groupByYearMonth, kstDayOfMonth } from "@/lib/archive";
import { isoInstant } from "@/lib/kst";

export const metadata = {
  title: "아카이브",
  description: "모든 글을 연·월별로 모아보기",
  alternates: { canonical: "/archive" },
};

// 런타임 DB 조회.
export const dynamic = "force-dynamic";

// 블로그 본편(/feed 범위) 전체 글을 KST 연→월로 묶은 목록. 무한스크롤로 닿기 어려운 과거 글 탐색용.
export default async function ArchivePage() {
  const role = await getViewerRole();
  const years = groupByYearMonth(await getArchiveFeeds(role));
  const total = years.reduce((n, y) => n + y.count, 0);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">아카이브</h1>
      <p className="mt-2 mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        글 {total}개
      </p>
      {years.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">아직 글이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-10">
          {years.map((y) => (
            <section key={y.year} aria-labelledby={`y${y.year}`}>
              <h2 id={`y${y.year}`} className="text-xl font-semibold">
                {y.year}년{" "}
                <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  {y.count}개
                </span>
              </h2>
              {y.months.map((m) => (
                <section
                  key={m.month}
                  aria-labelledby={`y${y.year}m${m.month}`}
                  className="mt-4"
                >
                  <h3
                    id={`y${y.year}m${m.month}`}
                    className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    {m.month}월
                  </h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {m.items.map((f) => (
                      <li key={f.slug} className="flex gap-3">
                        <time
                          dateTime={isoInstant(f.createdAt)}
                          className="w-10 shrink-0 text-sm text-zinc-500 tabular-nums dark:text-zinc-400"
                        >
                          {kstDayOfMonth(f.createdAt)}일
                        </time>
                        <Link
                          href={`/feed/${f.slug}`}
                          className="hover:underline"
                        >
                          {f.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
