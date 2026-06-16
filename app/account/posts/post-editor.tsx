"use client";
import { useActionState, useState } from "react";
import { submitPost, type PostFormState } from "./actions";
import MarkdownContent from "@/app/markdown-content";
import MarkdownHelp from "./markdown-help";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

export default function PostEditor({
  post,
}: {
  post?: {
    id: string;
    title: string;
    content: string;
    status: string;
    tags?: string;
  };
}) {
  const [state, action, pending] = useActionState<PostFormState, FormData>(
    submitPost,
    undefined,
  );
  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [tags, setTags] = useState(post?.tags ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const isPublished = post?.status === "published";
  const titleEmpty = title.trim() === "";
  const contentEmpty = content.trim() === "";
  // 제목 없으면 임시저장·게시 모두 불가. 내용 없으면 게시 불가(임시저장은 가능).
  const draftDisabled = pending || titleEmpty;
  const publishDisabled = pending || titleEmpty || contentEmpty;

  return (
    <form action={action} className="flex w-full max-w-2xl flex-col gap-4">
      {post && <input type="hidden" name="id" value={post.id} />}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-500">제목</span>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
        <span className="text-zinc-500">태그 (쉼표로 구분, 최대 5개)</span>
        <input
          name="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="던파, 개발 후기"
          className={inputCls}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center justify-between">
          <label htmlFor="post-content" className="text-zinc-500">
            본문 (마크다운)
          </label>
          <div
            role="tablist"
            aria-label="본문 보기 전환"
            className="flex gap-1 text-xs"
          >
            <button
              type="button"
              role="tab"
              id="tab-write"
              aria-selected={tab === "write"}
              aria-controls="panel-write"
              onClick={() => setTab("write")}
              className={`rounded px-2 py-1 ${
                tab === "write"
                  ? "bg-black/[.06] font-medium dark:bg-white/[.1]"
                  : "text-zinc-500"
              }`}
            >
              작성
            </button>
            <button
              type="button"
              role="tab"
              id="tab-preview"
              aria-selected={tab === "preview"}
              aria-controls="panel-preview"
              onClick={() => setTab("preview")}
              className={`rounded px-2 py-1 ${
                tab === "preview"
                  ? "bg-black/[.06] font-medium dark:bg-white/[.1]"
                  : "text-zinc-500"
              }`}
            >
              미리보기
            </button>
          </div>
        </div>

        {/* 작성 탭: textarea는 항상 마운트(폼 제출 보존), 미리보기일 땐 hidden */}
        <div
          id="panel-write"
          role="tabpanel"
          aria-labelledby="tab-write"
          hidden={tab === "preview"}
        >
          <textarea
            id="post-content"
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            aria-invalid={state?.errors?.content ? true : undefined}
            className={`${inputCls} w-full resize-y font-mono`}
          />
        </div>

        {/* 미리보기 탭: 게시 화면과 동일한 렌더러로 결과 표시 */}
        {tab === "preview" && (
          <div
            id="panel-preview"
            role="tabpanel"
            aria-labelledby="tab-preview"
            className={`${inputCls} min-h-[24rem] overflow-auto`}
          >
            {contentEmpty ? (
              <p className="text-zinc-400">미리볼 내용이 없습니다.</p>
            ) : (
              <MarkdownContent content={content} />
            )}
          </div>
        )}

        {state?.errors?.content && (
          <span role="alert" className="text-xs text-red-600">
            {state.errors.content[0]}
          </span>
        )}
      </div>

      <MarkdownHelp />

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
            disabled={draftDisabled}
            className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-medium disabled:opacity-50 dark:border-white/20"
          >
            임시저장
          </button>
        )}
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={publishDisabled}
          className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {isPublished ? "저장" : "게시(회원공개)"}
        </button>
      </div>
    </form>
  );
}
