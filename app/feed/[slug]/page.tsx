import { notFound } from "next/navigation";
import { getFeedBySlug, searchFeeds } from "@/lib/feeds";
import { getViewerRole } from "@/lib/dal";
import { checkAccess, type Visibility } from "@/lib/visibility";
import FeedArticle from "@/app/feed/feed-article";
import FeedEngagement from "@/app/feed/feed-engagement";
import MemberGate from "@/app/member-gate";
import ViewTracker from "@/app/view-tracker";
import ShareBar from "@/app/share-bar";
import { absoluteUrl, firstContentImage, toAbsolute } from "@/lib/share";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [feed, role] = await Promise.all([
    getFeedBySlug(slug),
    getViewerRole(),
  ]);
  if (!feed) return { title: "찾을 수 없음" };
  const access = checkAccess(feed.visibility as Visibility, role);
  if (access === "not-found") return { title: "찾을 수 없음" };
  const description =
    access === "ok" ? feed.summary?.trim() || undefined : undefined;
  const img = access === "ok" ? firstContentImage(feed.content) : null;
  const images = img ? [toAbsolute(img)] : undefined;
  return {
    title: feed.title,
    description,
    openGraph: { type: "article", title: feed.title, description, images },
  };
}

export default async function FeedDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const [feed, role] = await Promise.all([
    getFeedBySlug(slug),
    getViewerRole(),
  ]);
  if (!feed) notFound();

  const access = checkAccess(feed.visibility as Visibility, role);
  if (access === "not-found") notFound(); // 비공개: 관리자 외 404
  if (access === "members-only") {
    // 회원 공개 + 비로그인: 안내 + 가입/로그인 유도 + 다른 전체공개 글.
    const { items } = await searchFeeds({ role: "anon", take: 5 });
    return (
      <MemberGate
        title="회원에게만 공개된 글입니다"
        related={items.map((f) => ({
          href: `/feed/${f.slug}`,
          label: f.title,
        }))}
        backHref="/feed"
        backLabel="피드 목록"
      />
    );
  }

  const sort = (await searchParams).sort === "newest" ? "newest" : "popular";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <ViewTracker type="feed" id={feed.id} />
      <FeedArticle feed={feed} />
      <div className="mt-6 border-t border-black/[.06] pt-6 dark:border-white/[.1]">
        <ShareBar
          url={absoluteUrl(`/feed/${feed.slug}`)}
          title={feed.title}
          description={feed.summary?.trim() || undefined}
          kakaoKey={process.env.KAKAO_JS_KEY}
          imageUrl={(() => {
            const i = firstContentImage(feed.content);
            return i ? toAbsolute(i) : undefined;
          })()}
        />
      </div>
      <FeedEngagement feedId={feed.id} slug={feed.slug} sort={sort} />
    </main>
  );
}
