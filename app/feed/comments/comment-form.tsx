"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import type { CommentNode } from "@/lib/comments";
import LoginRequiredModal from "../login-required-modal";
import { addCommentAction, type AddCommentResult } from "./comment-actions";

const MAX = 2000;

export default function CommentForm({
  feedId,
  slug,
  parentId,
  canParticipate,
  placeholder = "댓글을 입력하세요",
  onCreated,
}: {
  feedId: string;
  slug: string;
  parentId?: string;
  canParticipate: boolean;
  placeholder?: string;
  onCreated?: (comment: CommentNode) => void;
}) {
  const action = addCommentAction.bind(null, { feedId, slug, parentId });
  const [content, setContent] = useState("");
  const [state, formAction, pending] = useActionState<
    AddCommentResult | undefined,
    FormData
  >(async (s, fd) => {
    const r = await action(s, fd);
    if (r && "comment" in r) {
      setContent("");
      onCreated?.(r.comment);
    }
    return r;
  }, undefined);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const modal = useRef<HTMLDialogElement>(null);

  // 입력에 맞춰 높이 자동 확장. 최대 5줄(max-height)까지 늘고 그 이상은 스크롤.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [content]);

  if (!canParticipate) {
    return (
      <>
        <button
          type="button"
          onClick={() => modal.current?.showModal()}
          className="w-full rounded-lg border border-black/15 p-3 text-left text-sm text-zinc-500 dark:border-white/20"
        >
          {placeholder}
        </button>
        <LoginRequiredModal ref={modal} />
      </>
    );
  }

  const tooLong = content.length > MAX;
  const empty = content.trim().length === 0;
  const disabled = pending || empty || tooLong;
  const error = state && "error" in state ? state.error : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        ref={taRef}
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={MAX}
        rows={1}
        placeholder={placeholder}
        className="max-h-[7.75rem] min-h-[2.75rem] w-full resize-none overflow-y-auto rounded-lg border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <div className="flex items-center justify-between gap-3">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <span
            className={`text-xs ${tooLong ? "text-red-600" : "text-zinc-400"}`}
          >
            {content.length}/{MAX}
          </span>
        )}
        <button
          type="submit"
          disabled={disabled}
          className="bg-foreground text-background shrink-0 rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {pending ? "등록 중…" : parentId ? "답글" : "댓글 등록"}
        </button>
      </div>
    </form>
  );
}
