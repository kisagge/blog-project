import { getSession, getViewerRole } from "@/lib/dal";
import { getCommentActor } from "@/lib/comment-actor";
import { getFeedComments, type CommentSort } from "@/lib/comments";
import { getLikeSummary } from "@/lib/likes";
import LikeButton from "./like-button";
import CommentSection from "./comments/comment-section";
import { FeedEventsProvider } from "./feed-events-context";

export default async function FeedEngagement({
  feedId,
  slug,
  sort = "popular",
  highlightCommentId,
}: {
  feedId: string;
  slug: string;
  sort?: CommentSort;
  highlightCommentId?: string;
}) {
  const session = await getSession();
  const actor = await getCommentActor();
  const role = await getViewerRole(); // 상세 페이지가 이미 호출 → cache()로 추가 비용 0
  const isAdmin = session?.role === "admin";
  const canParticipate = !!actor;
  // 비회원(anon) 뷰어에겐 작성자 닉네임을 평문으로(막다른 프로필 링크 제거).
  const linkAuthors = role !== "anon";
  const [page, like] = await Promise.all([
    getFeedComments(feedId, { sort, viewerUserId: actor?.userId }),
    getLikeSummary(feedId, actor?.userId),
  ]);

  return (
    <section className="mt-10 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
      {/* 댓글·좋아요가 피드 SSE 연결 1개를 공유 */}
      <FeedEventsProvider feedId={feedId}>
        <LikeButton
          feedId={feedId}
          slug={slug}
          initialCount={like.count}
          initialLiked={like.liked}
          canParticipate={canParticipate}
        />
        {/* 정렬 변경(URL) 시 새 초기 데이터로 다시 마운트 */}
        <CommentSection
          key={sort}
          feedId={feedId}
          slug={slug}
          sort={sort}
          canParticipate={canParticipate}
          actorUserId={actor?.userId}
          isAdmin={isAdmin}
          linkAuthors={linkAuthors}
          initialItems={page.items}
          initialTotal={page.total}
          initialHighlightId={highlightCommentId}
        />
      </FeedEventsProvider>
    </section>
  );
}
