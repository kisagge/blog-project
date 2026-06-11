import { getSession } from "@/lib/dal";
import { getCommentActor } from "@/lib/comment-actor";
import { getFeedComments } from "@/lib/comments";
import { getLikeSummary } from "@/lib/likes";
import LikeButton from "./like-button";
import CommentForm from "./comment-form";
import CommentList from "./comment-list";

export default async function FeedEngagement({
  feedId,
  slug,
}: {
  feedId: string;
  slug: string;
}) {
  const session = await getSession();
  const actor = await getCommentActor();
  const isAdmin = session?.role === "admin";
  const canParticipate = !!actor;
  const [comments, like] = await Promise.all([
    getFeedComments(feedId),
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
      <h2 className="mt-8 mb-4 text-lg font-semibold tracking-tight">
        댓글 {comments.length}
      </h2>
      <div className="mb-6">
        <CommentForm
          feedId={feedId}
          slug={slug}
          canParticipate={canParticipate}
        />
      </div>
      <CommentList
        comments={comments}
        feedId={feedId}
        slug={slug}
        canParticipate={canParticipate}
        actorUserId={actor?.userId}
        isAdmin={isAdmin}
      />
    </section>
  );
}
