"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import MarkdownContent from "@/app/markdown-content";
import MarkdownHelp from "@/app/account/posts/markdown-help";
import { uploadImage } from "@/app/admin/upload-action";
import { saveAboutAction, type AboutFormState } from "@/app/admin/site-actions";
import { ABOUT_MAX_LENGTH } from "@/lib/validation";
import {
  imageMarkdown,
  insertIntoTextarea,
  IMAGE_ALT_HINT,
} from "@/lib/textarea";
import { takeFile, useImageUpload } from "@/app/ui/use-image-upload";
import TabList, { EDITOR_TABS, panelId, tabId } from "@/app/ui/tab-list";

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
  const { uploading, uploadFile } = useImageUpload(uploadImage);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notice, setNotice] = useState(""); // 업로드 후 대체 텍스트 입력 안내(상태 영역)
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tooLong = content.length > ABOUT_MAX_LENGTH;

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = takeFile(e);
    if (!file) return;
    setUploadError(null);
    const res = await uploadFile(file);
    if ("error" in res) return setUploadError(res.error);
    const { text, caret } = imageMarkdown(res.url);
    insertIntoTextarea(taRef.current, content, setContent, text, caret); // 캐럿을 대체 텍스트 자리([ ] 안)로
    setNotice(IMAGE_ALT_HINT);
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label htmlFor="about-content" className="text-sm font-medium">
          소개 본문 (마크다운)
        </label>
        <TabList
          label="소개 본문 보기 전환"
          prefix="about"
          variant="pill"
          tabs={EDITOR_TABS}
          active={tab}
          onChange={setTab}
        />
      </div>

      {/* 작성 탭: textarea는 항상 마운트(폼 제출 보존), 미리보기일 땐 hidden */}
      <div
        id={panelId("about", "write")}
        role="tabpanel"
        aria-labelledby={tabId("about", "write")}
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
          {/* 상태 영역은 항상 마운트(도중에 생긴 live region은 읽히지 않을 수 있음) */}
          <span role="status" className="text-zinc-500">
            {uploading ? "업로드 중…" : notice}
          </span>
        </div>
        {uploadError && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
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
          aria-invalid={tooLong || state?.error ? true : undefined}
          aria-describedby="about-hint"
          className={`${inputCls} w-full resize-y font-mono`}
        />
      </div>

      {/* 미리보기 탭: 패널은 항상 마운트(aria-controls 참조 유지), 렌더는 미리보기일 때만. */}
      <div
        id={panelId("about", "preview")}
        role="tabpanel"
        aria-labelledby={tabId("about", "preview")}
        hidden={tab === "write"}
        className={`${inputCls} min-h-[24rem] overflow-auto`}
      >
        {tab === "preview" &&
          (content.trim() ? (
            <MarkdownContent content={content} />
          ) : (
            <p className="text-zinc-500">미리볼 내용이 없습니다.</p>
          ))}
      </div>

      <p
        id="about-hint"
        className={`text-xs ${tooLong ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}
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
          {state?.done && !pending ? "저장했습니다." : ""}
        </span>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state?.error}
        </p>
      )}
    </form>
  );
}
