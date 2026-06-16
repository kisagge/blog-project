import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeedBySlug, searchFeeds } from "@/lib/feeds";
import { getViewerRole, getSession, isBlockedMember } from "@/lib/dal";
import { getAdminNickname } from "@/lib/comment-actor";
import { checkAccess, type Visibility } from "@/lib/visibility";
import FeedArticle from "@/app/feed/feed-article";
import FeedEngagement from "@/app/feed/feed-engagement";
import MemberGate from "@/app/member-gate";
import ViewTracker from "@/app/view-tracker";
import ShareBar from "@/app/share-bar";
import ReportButton from "@/app/report/report-button";
import { absoluteUrl, firstContentImage, toAbsolute } from "@/lib/share";

// 임시저장(draft) 글은 작성자 본인(또는 관리자)만 볼 수 있다.
type DraftCheck = { status: string; authorId: string | null };
function canViewDraft(
  feed: DraftCheck,
  session: Awaited<ReturnType<typeof getSession>>,
): boolean {
  if (feed.status !== "draft") return true;
  if (session?.role === "admin") return true;
  return session?.role === "member" && session.userId === feed.authorId;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [feed, role, session] = await Promise.all([
    getFeedBySlug(slug),
    getViewerRole(),
    getSession(),
  ]);
  if (!feed) return { title: "찾을 수 없음" };
  if (!canViewDraft(feed, session)) return { title: "찾을 수 없음" };
  if (feed.status === "draft") return { title: feed.title }; // 본인 임시저장
  if (feed.hiddenAt && role !== "admin") return { title: "찾을 수 없음" }; // 신고 숨김
  const access = checkAccess(feed.visibility as Visibility, role);
  if (access === "not-found") return { title: "찾을 수 없음" };
  const description =
    access === "ok" ? feed.summary?.trim() || undefined : undefined;
  // og:image는 파일 기반 opengraph-image.tsx가 동적 생성(전체공개 글만 제목 노출).
  return {
    title: feed.title,
    description,
    openGraph: { type: "article", title: feed.title, description },
  };
}

export default async function FeedDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; c?: string }>;
}) {
  const { slug } = await params;
  const [feed, role, session] = await Promise.all([
    getFeedBySlug(slug),
    getViewerRole(),
    getSession(),
  ]);
  if (!feed) notFound();

  // 임시저장: 본인만 미리보기(공유·댓글·조회수 없이 본문만).
  if (feed.status === "draft") {
    if (!canViewDraft(feed, session)) notFound();
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <p
          role="status"
          className="mb-6 rounded bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
        >
          임시저장 미리보기입니다. 게시 전에는 본인만 볼 수 있어요.
        </p>
        <FeedArticle
          feed={feed}
          authorName={feed.author?.nickname}
          authorId={feed.authorId}
          tags={feed.feedTags.map((ft) => ft.tag)}
        />
        <div className="mt-6">
          <Link
            href={`/account/posts/${feed.id}/edit`}
            className="text-sm underline"
          >
            수정하기
          </Link>
        </div>
      </main>
    );
  }

  // 신고로 가려진 글: 관리자만 열람(검토용), 그 외엔 404.
  if (feed.hiddenAt && role !== "admin") notFound();

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

  const sp = await searchParams;
  const sort = sp.sort === "newest" ? "newest" : "popular";
  // 작성자 표시: 회원 글이면 작성자 닉네임, 관리자 글이면 관리자 닉네임.
  const authorName = feed.author?.nickname ?? (await getAdminNickname());
  const blocked = await isBlockedMember(); // 차단 회원은 공유 버튼 비노출
  // 신고: 회원이 본인 아닌 회원 글에만(관리자 글·본인 글 제외).
  const canReportFeed =
    session?.role === "member" &&
    !!feed.authorId &&
    session.userId !== feed.authorId;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <ViewTracker type="feed" id={feed.id} />
      <FeedArticle
        feed={feed}
        authorName={authorName}
        authorId={feed.authorId}
        tags={feed.feedTags.map((ft) => ft.tag)}
      />
      {/* 비공개(초안)는 공유해도 타인에겐 404, 차단 회원은 공유 불가 — 공유 버튼 비노출. */}
      {feed.visibility !== "private" && !blocked && (
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
      )}
      {canReportFeed && (
        <div className="mt-4 text-right text-xs text-zinc-400">
          <ReportButton targetType="feed" targetId={feed.id} />
        </div>
      )}
      <FeedEngagement
        feedId={feed.id}
        slug={feed.slug}
        sort={sort}
        highlightCommentId={sp.c}
      />
    </main>
  );
}
