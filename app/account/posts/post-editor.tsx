"use client";
import { useActionState } from "react";
import { submitPost, type PostFormState } from "./actions";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

export default function PostEditor({
  post,
}: {
  post?: { id: string; title: string; content: string; status: string };
}) {
  const [state, action, pending] = useActionState<PostFormState, FormData>(
    submitPost,
    undefined,
  );
  const isPublished = post?.status === "published";

  return (
    <form action={action} className="flex w-full max-w-2xl flex-col gap-4">
      {post && <input type="hidden" name="id" value={post.id} />}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-500">제목</span>
        <input
          name="title"
          defaultValue={post?.title}
          maxLength={120}
          aria-invalid={state?.errors?.title ? true : undefined}
          className={inputCls}
        />
        {state?.errors?.title && (
          <span role="alert" className="text-xs text-red-600">
            {state.errors.title[0]}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-500">본문 (마크다운)</span>
        <textarea
          name="content"
          defaultValue={post?.content}
          rows={16}
          aria-invalid={state?.errors?.content ? true : undefined}
          className={`${inputCls} resize-y font-mono`}
        />
        {state?.errors?.content && (
          <span role="alert" className="text-xs text-red-600">
            {state.errors.content[0]}
          </span>
        )}
      </label>
      <p className="-mt-2 text-xs text-zinc-500">
        외부 이미지 URL은{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          ![](https://…)
        </code>{" "}
        로 넣을 수 있어요. 파일 업로드는 지원하지 않습니다.
      </p>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        {!isPublished && (
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-medium disabled:opacity-50 dark:border-white/20"
          >
            임시저장
          </button>
        )}
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {isPublished ? "저장" : "게시(회원공개)"}
        </button>
      </div>
    </form>
  );
}
