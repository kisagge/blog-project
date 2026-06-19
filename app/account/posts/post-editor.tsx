"use client";
import { INPUT_CLASS, PRIMARY_BTN } from "@/lib/ui";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitPost, type PostFormState } from "./actions";
import { uploadPostImage } from "./image-action";
import { checkImage } from "@/lib/upload";
import { spliceText } from "@/lib/textarea";
import MarkdownContent from "@/app/markdown-content";
import MarkdownHelp from "./markdown-help";
import DraftRestoreBanner from "@/app/draft-restore-banner";
import {
  draftKey,
  loadDraft,
  saveDraft,
  clearDraft,
  pruneDrafts,
} from "@/lib/draft-store";

const inputCls = INPUT_CLASS;
type PostDraft = { title: string; content: string; tags: string };

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
  const [restorable, setRestorable] = useState<PostDraft | null>(null);
  const key = draftKey("member", post?.id ?? "new");

  // 본문 이미지 업로드(아바타와 동일 인프라 재사용 — 회원 가드·레이트리밋·매직바이트).
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    setUploadError(null);
    const pre = checkImage(file.type, file.size);
    if (!pre.ok) {
      setUploadError(pre.error);
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadPostImage(fd);
    setUploading(false);
    if ("error" in res) {
      setUploadError(res.error);
      return;
    }
    // 커서 위치에 마크다운 이미지 삽입 + 캐럿 복원(제어 상태라 setContent로 자동저장도 갱신).
    const ta = taRef.current;
    const start = ta?.selectionStart ?? content.length;
    const end = ta?.selectionEnd ?? content.length;
    const insert = `![](${res.url})\n`;
    setContent(spliceText(content, start, end, insert));
    requestAnimationFrame(() => {
      const pos = start + insert.length;
      if (ta) {
        ta.selectionStart = ta.selectionEnd = pos;
        ta.focus();
      }
    });
  }

  // 마운트: 오래된 초안 정리 + 저장본이 초기값과 다르면 복원 제안.
  useEffect(() => {
    pruneDrafts();
    const d = loadDraft<PostDraft>(key);
    if (d && (d.title || d.content || d.tags)) {
      const changed =
        d.title !== (post?.title ?? "") ||
        d.content !== (post?.content ?? "") ||
        d.tags !== (post?.tags ?? "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (changed) setRestorable(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 자동저장(800ms 디바운스). 첫 렌더·전부 빈값은 스킵.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (title || content || tags) saveDraft(key, { title, content, tags });
    }, 800);
    return () => clearTimeout(t);
  }, [title, content, tags, key]);

  // 제출 실패(검증 에러 반환, 리다이렉트 없음) 시 clear-on-submit으로 지워진 초안을 복구.
  useEffect(() => {
    if (state?.errors || state?.error) saveDraft(key, { title, content, tags });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function restore() {
    if (restorable) {
      setTitle(restorable.title);
      setContent(restorable.content);
      setTags(restorable.tags);
    }
    setRestorable(null);
  }
  function ignoreDraft() {
    clearDraft(key);
    setRestorable(null);
  }

  const isPublished = post?.status === "published";
  const titleEmpty = title.trim() === "";
  const contentEmpty = content.trim() === "";
  // 제목 없으면 임시저장·게시 모두 불가. 내용 없으면 게시 불가(임시저장은 가능).
  const draftDisabled = pending || titleEmpty;
  const publishDisabled = pending || titleEmpty || contentEmpty;

  return (
    <form
      action={action}
      onSubmit={() => clearDraft(key)}
      className="flex w-full max-w-2xl flex-col gap-4"
    >
      {post && <input type="hidden" name="id" value={post.id} />}
      {restorable && (
        <DraftRestoreBanner onRestore={restore} onDismiss={ignoreDraft} />
      )}

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
          <div className="mb-2 flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded border border-black/15 px-2 py-1 disabled:opacity-50 dark:border-white/20"
            >
              이미지 첨부
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              tabIndex={-1}
              aria-hidden
              onChange={handleImage}
              className="sr-only"
            />
            {uploading && (
              <span role="status" className="text-zinc-500">
                업로드 중…
              </span>
            )}
          </div>
          {uploadError && (
            <p role="alert" className="mb-2 text-xs text-red-600">
              {uploadError}
            </p>
          )}
          <textarea
            ref={taRef}
            id="post-content"
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            aria-invalid={state?.errors?.content ? true : undefined}
            className={`${inputCls} w-full resize-y font-mono`}
          />
        </div>

        {/* 미리보기 탭: 게시 화면과 동일한 렌더러로 결과 표시.
            패널은 항상 마운트(aria-controls 참조 유지) + hidden으로 토글,
            렌더링은 미리보기일 때만(작성 중 매 타이핑 렌더 방지). */}
        <div
          id="panel-preview"
          role="tabpanel"
          aria-labelledby="tab-preview"
          hidden={tab === "write"}
          className={`${inputCls} min-h-[24rem] overflow-auto`}
        >
          {tab === "preview" &&
            (contentEmpty ? (
              <p className="text-zinc-400">미리볼 내용이 없습니다.</p>
            ) : (
              <MarkdownContent content={content} />
            ))}
        </div>

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
          className={PRIMARY_BTN}
        >
          {isPublished ? "저장" : "게시(회원공개)"}
        </button>
      </div>
    </form>
  );
}
