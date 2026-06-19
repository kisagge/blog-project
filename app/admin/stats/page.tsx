import Link from "next/link";
import {
  getStatsSummary,
  getViewTrend,
  getSignupTrend,
  getTopFeeds,
} from "@/lib/stats";
import StatBarList from "./stat-bar-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "통계" };

export default async function StatsPage() {
  const [summary, viewTrend, signupTrend, topFeeds] = await Promise.all([
    getStatsSummary(),
    getViewTrend(14),
    getSignupTrend(14),
    getTopFeeds(10),
  ]);

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold tracking-tight">통계</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="총 조회수" value={summary.totalViews} />
        <Stat label="회원" value={summary.members} />
        <Stat label="댓글" value={summary.comments} />
        <Stat label="글" value={summary.feeds} />
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <section aria-labelledby="view-trend">
          <h2 id="view-trend" className="mb-3 text-sm font-semibold">
            조회수 추이 (최근 14일)
          </h2>
          <StatBarList data={viewTrend} />
        </section>
        <section aria-labelledby="signup-trend">
          <h2 id="signup-trend" className="mb-3 text-sm font-semibold">
            가입 추이 (최근 14일)
          </h2>
          <StatBarList data={signupTrend} />
        </section>
      </div>

      <section aria-labelledby="top-feeds">
        <h2 id="top-feeds" className="mb-3 text-sm font-semibold">
          인기글 Top 10
        </h2>
        {topFeeds.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 글이 없습니다.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
            {topFeeds.map((f, i) => (
              <li
                key={f.slug}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-zinc-400 tabular-nums">
                    {i + 1}
                  </span>
                  <Link
                    href={`/feed/${f.slug}`}
                    className="truncate hover:underline"
                  >
                    {f.title}
                  </Link>
                </span>
                <span className="shrink-0 text-zinc-500 tabular-nums">
                  조회 {f.viewCount.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}
