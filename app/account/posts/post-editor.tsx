"use client";
import { FIELD_ERROR, INPUT_CLASS, PRIMARY_BTN } from "@/lib/ui";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitPost, type PostFormState } from "./actions";
import { uploadPostImage } from "./image-action";
import {
  insertIntoTextarea,
  imageMarkdown,
  IMAGE_ALT_HINT,
} from "@/lib/textarea";
import MarkdownContent from "@/app/markdown-content";
import MarkdownHelp from "./markdown-help";
import DraftRestoreBanner from "@/app/draft-restore-banner";
import { draftKey } from "@/lib/draft-store";
import { useDraft } from "@/app/ui/use-draft";
import FormField from "@/app/ui/form-field";
import { takeFile, useImageUpload } from "@/app/ui/use-image-upload";
import TabList, { EDITOR_TABS, panelId, tabId } from "@/app/ui/tab-list";

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
  const draft = useDraft<PostDraft>(draftKey("member", post?.id ?? "new"), {
    title: post?.title ?? "",
    content: post?.content ?? "",
    tags: post?.tags ?? "",
  });

  // 본문 이미지 업로드(아바타와 동일 인프라 재사용 — 회원 가드·레이트리밋·매직바이트).
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploading, uploadFile } = useImageUpload(uploadPostImage);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notice, setNotice] = useState(""); // 업로드 후 대체 텍스트 입력 안내(상태 영역)

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = takeFile(e);
    if (!file) return;
    setUploadError(null);
    const res = await uploadFile(file);
    if ("error" in res) return setUploadError(res.error);
    // 커서 위치에 마크다운 이미지 삽입 + 캐럿을 대체 텍스트 자리([ ] 안)로(제어 상태라 자동저장도 갱신).
    const { text, caret } = imageMarkdown(res.url);
    insertIntoTextarea(taRef.current, content, setContent, text, caret);
    setNotice(IMAGE_ALT_HINT);
  }

  // 자동저장(800ms 디바운스). 첫 렌더·전부 빈값은 스킵.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    draft.saveSoon(() => ({ title, content, tags }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, tags]);

  // 제출 실패(검증 에러 반환, 리다이렉트 없음) 시 제출할 때 지운 초안을 되살림.
  useEffect(() => {
    if (state?.errors || state?.error) draft.save({ title, content, tags });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function restore() {
    const saved = draft.accept();
    if (saved) {
      setTitle(saved.title);
      setContent(saved.content);
      setTags(saved.tags);
    }
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
      onSubmit={draft.clear}
      className="flex w-full max-w-2xl flex-col gap-4"
    >
      {post && <input type="hidden" name="id" value={post.id} />}
      {draft.restorable && (
        <DraftRestoreBanner onRestore={restore} onDismiss={draft.dismiss} />
      )}

      <FormField
        className="text-sm"
        id="post-title"
        label="제목"
        error={state?.errors?.title}
        labelClassName="text-zinc-500"
      >
        {(control) => (
          <input
            {...control}
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className={INPUT_CLASS}
          />
        )}
      </FormField>

      <FormField
        className="text-sm"
        id="post-tags"
        label="태그 (쉼표로 구분, 최대 5개)"
        error={state?.errors?.tags}
        labelClassName="text-zinc-500"
      >
        {(control) => (
          <input
            {...control}
            name="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="던파, 개발 후기"
            className={INPUT_CLASS}
          />
        )}
      </FormField>

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center justify-between">
          <label htmlFor="post-content" className="text-zinc-500">
            본문 (마크다운)
          </label>
          <TabList
            label="본문 보기 전환"
            prefix="post"
            variant="pill"
            tabs={EDITOR_TABS}
            active={tab}
            onChange={setTab}
          />
        </div>

        {/* 작성 탭: textarea는 항상 마운트(폼 제출 보존), 미리보기일 땐 hidden */}
        <div
          id={panelId("post", "write")}
          role="tabpanel"
          aria-labelledby={tabId("post", "write")}
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
            {/* 상태 영역은 항상 마운트(도중에 생긴 live region은 읽히지 않을 수 있음) */}
            <span role="status" className="text-zinc-500">
              {uploading ? "업로드 중…" : notice}
            </span>
          </div>
          {uploadError && (
            <p
              role="alert"
              className="mb-2 text-xs text-red-600 dark:text-red-400"
            >
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
            aria-describedby={
              state?.errors?.content ? "post-content-error" : undefined
            }
            className={`${INPUT_CLASS} w-full resize-y font-mono`}
          />
        </div>

        {/* 미리보기 탭: 게시 화면과 동일한 렌더러로 결과 표시.
            패널은 항상 마운트(aria-controls 참조 유지) + hidden으로 토글,
            렌더링은 미리보기일 때만(작성 중 매 타이핑 렌더 방지). */}
        <div
          id={panelId("post", "preview")}
          role="tabpanel"
          aria-labelledby={tabId("post", "preview")}
          hidden={tab === "write"}
          className={`${INPUT_CLASS} min-h-[24rem] overflow-auto`}
        >
          {tab === "preview" &&
            (contentEmpty ? (
              <p className="text-zinc-500">미리볼 내용이 없습니다.</p>
            ) : (
              <MarkdownContent content={content} />
            ))}
        </div>

        {state?.errors?.content && (
          <p id="post-content-error" role="alert" className={FIELD_ERROR}>
            {state.errors.content.join(" ")}
          </p>
        )}
      </div>

      <MarkdownHelp />

      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
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
