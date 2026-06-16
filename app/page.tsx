import Link from "next/link";
import { guardPublicAccess } from "@/lib/site-config";
import { searchFeeds } from "@/lib/feeds";
import { getViewerRole } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function Home() {
  await guardPublicAccess();
  const role = await getViewerRole();
  // 최근 피드 글(뷰어가 볼 수 있는 관리자 글) 미리보기.
  const { items: recent } = await searchFeeds({
    role,
    take: 5,
    author: "admin",
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-14 px-6 py-16">
      {/* 히어로 */}
      <section className="flex flex-col gap-5">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          BY Playground
        </h1>
        <p className="max-w-prose text-lg text-zinc-600 dark:text-zinc-400">
          생각과 기록을 남기는 개인 공간입니다.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/feed"
            className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium transition-colors hover:opacity-90"
          >
            피드 보기 →
          </Link>
          <Link
            href="/df"
            className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-medium hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.04]"
          >
            던파 캐릭터
          </Link>
        </div>
      </section>

      {/* 최근 글 */}
      {recent.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">최근 글</h2>
            <Link href="/feed" className="text-sm text-zinc-500 hover:underline">
              더 보기 →
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
            {recent.map((f) => (
              <li key={f.slug} className="py-4">
                <Link href={`/feed/${f.slug}`} className="group block">
                  <h3 className="font-medium tracking-tight group-hover:underline">
                    {f.title}
                  </h3>
                  {f.summary && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {f.summary}
                    </p>
                  )}
                  <time
                    dateTime={f.createdAt.toISOString()}
                    className="mt-1.5 block text-xs text-zinc-500"
                  >
                    {f.createdAt.toLocaleDateString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 둘러보기 섹션 카드 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">둘러보기</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SectionCard href="/feed" title="피드" desc="글과 기록" />
          <SectionCard href="/df" title="던파" desc="캐릭터 쇼케이스" />
          <SectionCard
            href="/community"
            title="커뮤니티"
            desc="회원들의 글 · 회원 전용"
          />
        </ul>
      </section>
    </main>
  );
}

function SectionCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-1 rounded-lg border border-black/[.08] p-4 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:hover:bg-white/[.03]"
      >
        <span className="font-medium tracking-tight">{title}</span>
        <span className="text-sm text-zinc-500">{desc}</span>
      </Link>
    </li>
  );
}
