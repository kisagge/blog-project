import { searchFeeds } from "@/lib/feeds";
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
  searchParams: Promise<{ q?: string }>;
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

  const q = (await searchParams).q ?? "";
  const { items, hasMore } = await searchFeeds({ q, role, author: "member" });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">커뮤니티</h1>
      <p className="mb-8 text-sm text-zinc-500">회원들이 작성한 글</p>
      <FeedList
        initialItems={items.map(toFeedCard)}
        initialHasMore={hasMore}
        initialQuery={q}
        author="member"
      />
    </main>
  );
}
