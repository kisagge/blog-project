"use client";
import { useState } from "react";
import Link from "next/link";
import CommentBody from "./comment-body";
import CommentForm from "./comment-form";
import CommentLikeButton from "./comment-like-button";
import type { CommentNode } from "@/lib/comments";

export default function CommentItem({
  node,
  feedId,
  slug,
  canParticipate,
  actorUserId,
  isAdmin,
  isReply = false,
  highlightId,
  initialHighlightId,
  onRequestDelete,
  onCreatedReply,
}: {
  node: CommentNode;
  feedId: string;
  slug: string;
  canParticipate: boolean;
  actorUserId?: string;
  isAdmin: boolean;
  isReply?: boolean;
  highlightId?: string | null;
  initialHighlightId?: string;
  onRequestDelete: (id: string) => void;
  onCreatedReply: (parentId: string, comment: CommentNode) => void;
}) {
  const [replying, setReplying] = useState(false);
  // 알림 딥링크 대상이 이 댓글의 답글이면 처음부터 펼쳐서 보이게.
  const [repliesOpen, setRepliesOpen] = useState(
    () =>
      !!initialHighlightId &&
      node.replies.some((r) => r.id === initialHighlightId),
  );
  const canDelete =
    !node.deleted &&
    (isAdmin || (!!actorUserId && actorUserId === node.userId));
  const replyCount = node.replies.length;

  return (
    <li
      id={`comment-${node.id}`}
      className={`${isReply ? "" : "border-b border-black/[.06] pb-3 dark:border-white/[.1]"} ${
        highlightId === node.id
          ? "-mx-2 rounded bg-amber-100/60 px-2 transition-colors dark:bg-amber-400/10"
          : ""
      }`}
    >
      <div className="flex items-center gap-2 text-sm">
        {node.deleted ? (
          <span className="font-medium">—</span>
        ) : node.authorRole === "member" ? (
          <Link
            href={`/u/${node.userId}`}
            className="font-medium hover:underline"
          >
            {node.nickname}
          </Link>
        ) : (
          <span className="font-medium">{node.nickname}</span>
        )}
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
        {!isReply && !node.deleted && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            답글
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => onRequestDelete(node.id)}
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
            onCreated={(reply) => {
              setRepliesOpen(true); // 답글 달면 펼쳐서 보이게
              onCreatedReply(node.id, reply);
              setReplying(false);
            }}
          />
        </div>
      )}

      {!isReply && replyCount > 0 && (
        <button
          type="button"
          onClick={() => setRepliesOpen((v) => !v)}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {repliesOpen ? "답글 숨기기" : `답글 ${replyCount}개 보기`}
        </button>
      )}
      {!isReply && repliesOpen && replyCount > 0 && (
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
              highlightId={highlightId}
              initialHighlightId={initialHighlightId}
              onRequestDelete={onRequestDelete}
              onCreatedReply={onCreatedReply}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
