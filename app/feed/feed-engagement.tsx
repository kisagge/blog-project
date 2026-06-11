import Link from "next/link";
import { getSession } from "@/lib/dal";
import { getCommentActor } from "@/lib/comment-actor";
import { getFeedComments, type CommentSort } from "@/lib/comments";
import { getLikeSummary } from "@/lib/likes";
import LikeButton from "./like-button";
import CommentForm from "./comment-form";
import CommentList from "./comment-list";

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
  const [comments, like] = await Promise.all([
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
      <div className="mt-8 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          댓글 {comments.length}
        </h2>
        <nav className="flex gap-3 text-sm">
          <SortLink slug={slug} value="popular" current={sort} label="인기순" />
          <SortLink slug={slug} value="newest" current={sort} label="최신순" />
        </nav>
      </div>
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

function SortLink({
  slug,
  value,
  current,
  label,
}: {
  slug: string;
  value: CommentSort;
  current: CommentSort;
  label: string;
}) {
  const active = current === value;
  return (
    <Link
      href={`/feed/${slug}?sort=${value}`}
      scroll={false}
      className={
        active
          ? "font-semibold"
          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      }
    >
      {label}
    </Link>
  );
}
