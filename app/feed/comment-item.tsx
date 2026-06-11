"use client";
import { useState, useTransition } from "react";
import CommentBody from "./comment-body";
import CommentForm from "./comment-form";
import CommentLikeButton from "./comment-like-button";
import { deleteCommentAction } from "./comment-actions";
import type { CommentNode } from "@/lib/comments";

export default function CommentItem({
  node,
  feedId,
  slug,
  canParticipate,
  actorUserId,
  isAdmin,
  isReply = false,
}: {
  node: CommentNode;
  feedId: string;
  slug: string;
  canParticipate: boolean;
  actorUserId?: string;
  isAdmin: boolean;
  isReply?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [pending, start] = useTransition();
  const canDelete =
    !node.deleted &&
    (isAdmin || (!!actorUserId && actorUserId === node.userId));

  return (
    <li
      className={
        isReply ? "" : "border-b border-black/[.06] pb-3 dark:border-white/[.1]"
      }
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">
          {node.deleted ? "—" : node.nickname}
        </span>
        <time className="text-xs text-zinc-400">
          {new Date(node.createdAt).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}
        </time>
      </div>
      {node.deleted ? (
        <p className="mt-1 text-sm text-zinc-400">삭제된 댓글입니다.</p>
      ) : (
        <div className="mt-1">
          <CommentBody content={node.content} />
        </div>
      )}
      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
        {!node.deleted && (
          <CommentLikeButton
            commentId={node.id}
            slug={slug}
            initialCount={node.likeCount}
            initialLiked={node.liked}
            canParticipate={canParticipate}
          />
        )}
        {!isReply &&
          (node.deleted ? (
            node.replies.length > 0 && <span>답글 {node.replies.length}</span>
          ) : (
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              답글{node.replies.length > 0 ? ` ${node.replies.length}` : ""}
            </button>
          ))}
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => deleteCommentAction(node.id, slug))}
            className="hover:text-red-600"
          >
            삭제
          </button>
        )}
      </div>
      {replying && (
        <div className="mt-2">
          <CommentForm
            feedId={feedId}
            slug={slug}
            parentId={node.id}
            canParticipate={canParticipate}
            placeholder="답글을 입력하세요"
            onDone={() => setReplying(false)}
          />
        </div>
      )}
      {node.replies.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3 border-l border-black/[.06] pl-4 dark:border-white/[.1]">
          {node.replies.map((r) => (
            <CommentItem
              key={r.id}
              node={r}
              feedId={feedId}
              slug={slug}
              canParticipate={canParticipate}
              actorUserId={actorUserId}
              isAdmin={isAdmin}
              isReply
            />
          ))}
        </ul>
      )}
    </li>
  );
}
