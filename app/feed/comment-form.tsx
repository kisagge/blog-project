"use client";
import { useActionState, useRef } from "react";
import LoginRequiredModal from "./login-required-modal";
import { addCommentAction, type ActionState } from "./comment-actions";

export default function CommentForm({
  feedId,
  slug,
  parentId,
  canParticipate,
  placeholder = "댓글을 입력하세요",
  onDone,
}: {
  feedId: string;
  slug: string;
  parentId?: string;
  canParticipate: boolean;
  placeholder?: string;
  onDone?: () => void;
}) {
  const action = addCommentAction.bind(null, { feedId, slug, parentId });
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (s, fd) => {
      const r = await action(s, fd);
      if (!r?.error) onDone?.();
      return r;
    },
    undefined,
  );
  const modal = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!canParticipate) {
    return (
      <>
        <button
          type="button"
          onClick={() => modal.current?.showModal()}
          className="w-full rounded border border-black/15 px-3 py-2 text-left text-sm text-zinc-500 dark:border-white/20"
        >
          {placeholder}
        </button>
        <LoginRequiredModal ref={modal} />
      </>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        formAction(fd);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        name="content"
        rows={parentId ? 2 : 3}
        maxLength={2000}
        placeholder={placeholder}
        className="rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background w-fit rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "등록 중…" : parentId ? "답글" : "댓글 등록"}
      </button>
    </form>
  );
}
