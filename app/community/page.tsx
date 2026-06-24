import Link from "next/link";
import { searchFeeds } from "@/lib/feeds";
import { getTagsWithCounts } from "@/lib/tags";
import { getViewerRole } from "@/lib/dal";
import { guardPublicAccess } from "@/lib/site-config";
import FeedList from "@/app/feed/(list)/feed-list";
import { toFeedCard } from "@/app/feed/(list)/feed-card";
import MemberGate from "@/app/member-gate";

export const metadata = {
  title: "커뮤니티",
  description: "회원들이 작성한 글",
};

export const dynamic = "force-dynamic";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string }>;
}) {
  await guardPublicAccess(); // 점검 모드: 비어드민 차단
  const role = await getViewerRole();

  // 비회원: 회원 전용 안내(로그인/가입 유도 + 공개 피드로 유도).
  if (role === "anon") {
    const { items } = await searchFeeds({
      role: "anon",
      take: 5,
      author: "admin",
    });
    return (
      <MemberGate
        title="회원만 볼 수 있는 커뮤니티입니다"
        related={items.map((f) => ({
          href: `/feed/${f.slug}`,
          label: f.title,
        }))}
        backHref="/feed"
        backLabel="피드"
      />
    );
  }

  const sp = await searchParams;
  const q = sp.q ?? "";
  const tag = sp.tag || undefined;
  const sort = sp.sort === "popular" ? "popular" : "latest";
  const [{ items, hasMore }, tags] = await Promise.all([
    searchFeeds({ q, role, author: "member", tag, sort }),
    getTagsWithCounts(role, { author: "member", limit: 12 }),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">커뮤니티</h1>
      <p className="mb-6 text-sm text-zinc-500">회원들이 작성한 글</p>
      {tags.length > 0 && (
        <nav
          aria-label="커뮤니티 태그"
          className="mb-6 flex flex-wrap gap-2 text-sm"
        >
          {tags.map((t) => {
            const active = tag === t.slug;
            return (
              <Link
                key={t.slug}
                href={
                  active
                    ? "/community"
                    : `/community?tag=${encodeURIComponent(t.slug)}`
                }
                aria-current={active ? "true" : undefined}
                className={`rounded-full border px-3 py-1 ${
                  active
                    ? "border-amber-400 bg-amber-100 font-medium text-amber-800 dark:border-amber-400/50 dark:bg-amber-400/15 dark:text-amber-300"
                    : "border-black/10 text-zinc-600 hover:bg-black/[.04] dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/[.06]"
                }`}
              >
                #{t.name}
              </Link>
            );
          })}
        </nav>
      )}
      <FeedList
        key={tag ?? ""}
        initialItems={items.map(toFeedCard)}
        initialHasMore={hasMore}
        initialQuery={q}
        author="member"
        initialTag={tag}
        initialSort={sort}
        showSort
      />
    </main>
  );
}
