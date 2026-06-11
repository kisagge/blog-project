import CommentItem from "./comment-item";
import type { CommentNode } from "@/lib/comments";

export default function CommentList({
  comments,
  feedId,
  slug,
  canParticipate,
  actorUserId,
  isAdmin,
}: {
  comments: CommentNode[];
  feedId: string;
  slug: string;
  canParticipate: boolean;
  actorUserId?: string;
  isAdmin: boolean;
}) {
  if (comments.length === 0)
    return <p className="text-sm text-zinc-500">첫 댓글을 남겨보세요.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          node={c}
          feedId={feedId}
          slug={slug}
          canParticipate={canParticipate}
          actorUserId={actorUserId}
          isAdmin={isAdmin}
        />
      ))}
    </ul>
  );
}
