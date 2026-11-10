"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import MarkdownContent from "@/app/markdown-content";
import MarkdownHelp from "@/app/account/posts/markdown-help";
import { uploadImage } from "@/app/admin/upload-action";
import { saveAboutAction, type AboutFormState } from "@/app/admin/actions";
import { checkImage } from "@/lib/upload";
import { ABOUT_MAX_LENGTH } from "@/lib/validation";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20";

// 소개 페이지 편집기: 작성/미리보기 탭(회원 에디터와 동일 패턴) + 이미지 첨부(관리자 업로드 재사용).
// 미리보기는 공개 /about과 같은 MarkdownContent로 렌더. 비워서 저장하면 공개 페이지·내비 링크가 숨겨진다.
export default function AboutEditor({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<AboutFormState, FormData>(
    saveAboutAction,
    {},
  );
  const [content, setContent] = useState(initial);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tooLong = content.length > ABOUT_MAX_LENGTH;

  function insertAtCursor(text: string) {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? content.length;
    const end = ta?.selectionEnd ?? content.length;
    setContent(content.slice(0, start) + text + content.slice(end));
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    const check = checkImage(file.type, file.size);
    if (!check.ok) return setUploadError(check.error);
    setUploadError(null);
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const res = await uploadImage(fd);
      if ("error" in res) setUploadError(res.error);
      else insertAtCursor(`![](${res.url})\n`);
    } catch {
      setUploadError("업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  const tabCls = (on: boolean) =>
    `rounded px-2 py-1 ${on ? "bg-black/[.06] font-medium dark:bg-white/[.1]" : "text-zinc-500 dark:text-zinc-400"}`;

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label htmlFor="about-content" className="text-sm font-medium">
          소개 본문 (마크다운)
        </label>
        <div
          role="tablist"
          aria-label="소개 본문 보기 전환"
          className="flex gap-1 text-xs"
        >
          <button
            type="button"
            role="tab"
            id="about-tab-write"
            aria-selected={tab === "write"}
            aria-controls="about-panel-write"
            onClick={() => setTab("write")}
            className={tabCls(tab === "write")}
          >
            작성
          </button>
          <button
            type="button"
            role="tab"
            id="about-tab-preview"
            aria-selected={tab === "preview"}
            aria-controls="about-panel-preview"
            onClick={() => setTab("preview")}
            className={tabCls(tab === "preview")}
          >
            미리보기
          </button>
        </div>
      </div>

      {/* 작성 탭: textarea는 항상 마운트(폼 제출 보존), 미리보기일 땐 hidden */}
      <div
        id="about-panel-write"
        role="tabpanel"
        aria-labelledby="about-tab-write"
        hidden={tab === "preview"}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-3 text-sm">
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
            <span role="status" className="text-zinc-500 dark:text-zinc-400">
              업로드 중…
            </span>
          )}
        </div>
        {uploadError && (
          <p role="alert" className="text-xs text-red-600">
            {uploadError}
          </p>
        )}
        <textarea
          ref={taRef}
          id="about-content"
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          aria-invalid={tooLong || state.error ? true : undefined}
          aria-describedby="about-hint"
          className={`${inputCls} w-full resize-y font-mono`}
        />
      </div>

      {/* 미리보기 탭: 패널은 항상 마운트(aria-controls 참조 유지), 렌더는 미리보기일 때만. */}
      <div
        id="about-panel-preview"
        role="tabpanel"
        aria-labelledby="about-tab-preview"
        hidden={tab === "write"}
        className={`${inputCls} min-h-[24rem] overflow-auto`}
      >
        {tab === "preview" &&
          (content.trim() ? (
            <MarkdownContent content={content} />
          ) : (
            <p className="text-zinc-500 dark:text-zinc-400">
              미리볼 내용이 없습니다.
            </p>
          ))}
      </div>

      <p
        id="about-hint"
        className={`text-xs ${tooLong ? "text-red-600" : "text-zinc-500 dark:text-zinc-400"}`}
      >
        {content.length.toLocaleString()} / {ABOUT_MAX_LENGTH.toLocaleString()}
        자 · 비워서 저장하면 소개 페이지와 메뉴 링크가 숨겨집니다.
      </p>

      <MarkdownHelp />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || tooLong}
          className="bg-foreground text-background rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        <Link
          href="/about"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          공개 페이지 보기
        </Link>
        <span
          role="status"
          className="text-sm text-green-700 dark:text-green-400"
        >
          {state.ok && !pending ? "저장했습니다." : ""}
        </span>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
