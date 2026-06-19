"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import ReportButton from "@/app/report/report-button";
import CommentBody from "./comment-body";
import CommentForm from "./comment-form";
import CommentLikeButton from "./comment-like-button";
import { editCommentAction } from "./comment-actions";
import { kstDateTime, isoInstant } from "@/lib/kst";
import type { CommentNode } from "@/lib/comments";

export default function CommentItem({
  node,
  feedId,
  slug,
  canParticipate,
  actorUserId,
  isAdmin,
  linkAuthors,
  isReply = false,
  highlightId,
  initialHighlightId,
  onRequestDelete,
  onCreatedReply,
  onEdited,
}: {
  node: CommentNode;
  feedId: string;
  slug: string;
  canParticipate: boolean;
  actorUserId?: string;
  isAdmin: boolean;
  linkAuthors: boolean; // 비회원(anon) 뷰어에겐 false → 작성자 닉네임 평문(막다른 프로필 링크 제거).
  isReply?: boolean;
  highlightId?: string | null;
  initialHighlightId?: string;
  onRequestDelete: (id: string) => void;
  onCreatedReply: (parentId: string, comment: CommentNode) => void;
  onEdited: (id: string, content: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  // 알림 딥링크 대상이 이 댓글의 답글이면 처음부터 펼쳐서 보이게.
  const [repliesOpen, setRepliesOpen] = useState(
    () =>
      !!initialHighlightId &&
      node.replies.some((r) => r.id === initialHighlightId),
  );
  const gone = node.deleted || node.hidden; // 삭제·숨김이면 액션 비노출
  const canDelete =
    !gone && (isAdmin || (!!actorUserId && actorUserId === node.userId));
  // 수정은 작성자 본인만(관리자도 타인 댓글 본문은 수정 안 함).
  const canEdit = !gone && !!actorUserId && actorUserId === node.userId;
  const replyCount = node.replies.length;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.content);
  const [editError, setEditError] = useState<string>();
  const [savingEdit, startEdit] = useTransition();

  function openEdit() {
    setEditValue(node.content);
    setEditError(undefined);
    setEditing(true);
  }
  function saveEdit() {
    const v = editValue.trim();
    setEditError(undefined);
    if (!v) {
      setEditError("내용을 입력하세요.");
      return;
    }
    startEdit(async () => {
      const res = await editCommentAction(node.id, feedId, slug, v);
      if ("error" in res) {
        setEditError(res.error);
        return;
      }
      onEdited(node.id, v);
      setEditing(false);
    });
  }

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
        {node.deleted || node.hidden ? (
          <span className="font-medium">—</span>
        ) : node.authorRole === "member" && linkAuthors ? (
          <Link
            href={`/u/${node.userId}`}
            className="font-medium hover:underline"
          >
            {node.nickname}
          </Link>
        ) : (
          <span className="font-medium">{node.nickname}</span>
        )}
        <time
          dateTime={isoInstant(node.createdAt)}
          className="text-xs text-zinc-400"
        >
          {kstDateTime(node.createdAt)}
        </time>
        {node.edited && !gone && (
          <span className="text-xs text-zinc-400">(수정됨)</span>
        )}
      </div>
      {node.deleted ? (
        <p className="mt-1 text-sm text-zinc-400">삭제된 댓글입니다.</p>
      ) : node.hidden ? (
        <p className="mt-1 text-sm text-zinc-400">신고로 가려진 댓글입니다.</p>
      ) : editing ? (
        <div className="mt-1 flex flex-col gap-2">
          <textarea
            aria-label="댓글 수정"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full resize-none rounded-lg border border-black/15 bg-transparent p-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
          {editError && (
            <p role="alert" className="text-xs text-red-600">
              {editError}
            </p>
          )}
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={saveEdit}
              disabled={savingEdit || editValue.trim() === ""}
              className="bg-foreground text-background rounded px-3 py-1 font-medium disabled:opacity-50"
            >
              {savingEdit ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditError(undefined);
              }}
              className="rounded border border-black/15 px-3 py-1 dark:border-white/20"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1">
          <CommentBody content={node.content} />
        </div>
      )}
      <div
        className="mt-1 flex items-center gap-3 text-xs text-zinc-500"
        hidden={editing}
      >
        {!gone && (
          <CommentLikeButton
            commentId={node.id}
            feedId={feedId}
            slug={slug}
            initialCount={node.likeCount}
            initialLiked={node.liked}
            canParticipate={canParticipate}
          />
        )}
        {!isReply && !gone && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            답글
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={openEdit}
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            수정
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
        {/* 신고: 로그인 회원(관리자 제외)이 타인의 살아있는 '회원' 댓글에만(관리자 댓글 제외). */}
        {canParticipate &&
          !isAdmin &&
          !gone &&
          node.authorRole === "member" &&
          !!actorUserId &&
          actorUserId !== node.userId && (
            <ReportButton targetType="comment" targetId={node.id} />
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
              linkAuthors={linkAuthors}
              isReply
              highlightId={highlightId}
              initialHighlightId={initialHighlightId}
              onRequestDelete={onRequestDelete}
              onCreatedReply={onCreatedReply}
              onEdited={onEdited}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
