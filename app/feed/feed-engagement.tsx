import { getSession } from "@/lib/dal";
import { getCommentActor } from "@/lib/comment-actor";
import { getFeedComments, type CommentSort } from "@/lib/comments";
import { getLikeSummary } from "@/lib/likes";
import LikeButton from "./like-button";
import CommentSection from "./comments/comment-section";

export default async function FeedEngagement({
  feedId,
  slug,
  sort = "popular",
}: {
  feedId: string;
  slug: string;
  sort?: CommentSort;
}) {
  const session = await getSession();
  const actor = await getCommentActor();
  const isAdmin = session?.role === "admin";
  const canParticipate = !!actor;
  const [page, like] = await Promise.all([
    getFeedComments(feedId, { sort, viewerUserId: actor?.userId }),
    getLikeSummary(feedId, actor?.userId),
  ]);

  return (
    <section className="mt-10 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
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
        initialItems={page.items}
        initialTotal={page.total}
      />
    </section>
  );
}
