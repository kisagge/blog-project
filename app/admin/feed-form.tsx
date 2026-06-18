"use client";
import { INPUT_CLASS } from "@/lib/ui";
import { useActionState, useEffect, useRef, useState } from "react";
import type { FeedFormState } from "@/app/admin/actions";
import { uploadImage } from "@/app/admin/upload-action";
import { ToastViewport, useToast } from "@/app/toast";
import { checkImage } from "@/lib/upload";
import DraftRestoreBanner from "@/app/draft-restore-banner";
import {
  draftKey,
  loadDraft,
  saveDraft,
  clearDraft,
  pruneDrafts,
} from "@/lib/draft-store";

type FeedDraft = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  visibility: string;
  tags: string;
};

type Props = {
  action: (state: FeedFormState, formData: FormData) => Promise<FeedFormState>;
  defaultValues?: {
    title?: string;
    slug?: string;
    summary?: string | null;
    content?: string;
    visibility?: "public" | "members" | "private";
    tags?: string;
  };
  submitLabel: string;
};

export default function FeedForm({
  action,
  defaultValues,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<FeedFormState, FormData>(
    action,
    undefined,
  );
  const d = defaultValues ?? {};
  const err = state?.errors ?? {};

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [restorable, setRestorable] = useState<FeedDraft | null>(null);
  const { toasts, show } = useToast();
  const key = draftKey("admin", d.slug ?? "new");

  // 마운트: 오래된 초안 정리 + 저장본이 초기값과 다르면 복원 제안.
  useEffect(() => {
    pruneDrafts();
    const dft = loadDraft<FeedDraft>(key);
    if (dft && Object.values(dft).some(Boolean)) {
      const init: FeedDraft = {
        title: d.title ?? "",
        slug: d.slug ?? "",
        summary: d.summary ?? "",
        content: d.content ?? "",
        visibility: d.visibility ?? "private",
        tags: d.tags ?? "",
      };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (JSON.stringify(dft) !== JSON.stringify(init)) setRestorable(dft);
    }
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // uncontrolled 폼의 현재 값을 초안 형태로 읽음(input·실패 복구 공용).
  function readForm(): FeedDraft | null {
    const f = formRef.current;
    if (!f) return null;
    const fd = new FormData(f);
    return {
      title: String(fd.get("title") ?? ""),
      slug: String(fd.get("slug") ?? ""),
      summary: String(fd.get("summary") ?? ""),
      content: String(fd.get("content") ?? ""),
      visibility: String(fd.get("visibility") ?? ""),
      tags: String(fd.get("tags") ?? ""),
    };
  }

  // form onInput으로 현재 값을 읽어 디바운스 저장.
  function onFormInput() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const data = readForm();
      if (data && Object.values(data).some(Boolean)) saveDraft(key, data);
    }, 800);
  }

  // 제출 실패(검증 에러 반환) 시 clear-on-submit으로 지워진 초안을 복구.
  useEffect(() => {
    if (state?.errors || state?.message) {
      const data = readForm();
      if (data && Object.values(data).some(Boolean)) saveDraft(key, data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function restore() {
    const f = formRef.current;
    if (f && restorable) {
      for (const [name, val] of Object.entries(restorable)) {
        const el = f.elements.namedItem(name);
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        )
          el.value = val;
      }
    }
    setRestorable(null);
  }
  function ignoreDraft() {
    clearDraft(key);
    setRestorable(null);
  }

  function insertAtCursor(text: string) {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    const pos = start + text.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
    // .value 직접 변경은 input 이벤트가 안 나므로, 자동저장이 잡도록 수동 디스패치.
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;

    // 업로드 전 선검증: 크기 초과 파일이 bodySizeLimit에 걸려 침묵 실패하는 걸 막고 즉시 피드백
    const check = checkImage(file.type, file.size);
    if (!check.ok) {
      show(check.error);
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const res = await uploadImage(fd);
      if ("error" in res) {
        show(res.error);
        return;
      }
      insertAtCursor(`![](${res.url})\n`);
      show("이미지를 본문에 삽입했습니다.", "success");
    } catch {
      show("업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        onInput={onFormInput}
        onSubmit={() => clearDraft(key)}
        className="flex flex-col gap-5"
      >
        {restorable && (
          <DraftRestoreBanner onRestore={restore} onDismiss={ignoreDraft} />
        )}
        <Field label="제목" error={err.title}>
          <input name="title" defaultValue={d.title} className={inputCls} />
        </Field>
        <Field label="slug (소문자·숫자·하이픈)" error={err.slug}>
          <input name="slug" defaultValue={d.slug} className={inputCls} />
        </Field>
        <Field label="요약 (선택)" error={err.summary}>
          <input
            name="summary"
            defaultValue={d.summary ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="태그 (쉼표로 구분, 최대 5개)" error={err.tags}>
          <input
            name="tags"
            defaultValue={d.tags ?? ""}
            placeholder="던파, 개발 후기"
            className={inputCls}
          />
        </Field>
        <Field label="본문 (마크다운)" error={err.content}>
          <textarea
            ref={contentRef}
            name="content"
            defaultValue={d.content}
            rows={12}
            className={inputCls}
          />
          <div className="mt-2 flex items-center gap-3 text-sm">
            <label className="cursor-pointer rounded border border-black/15 px-2 py-1 dark:border-white/20">
              이미지 첨부
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImage}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {uploading && <span className="text-zinc-500">업로드 중…</span>}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          공개 범위
          <select
            name="visibility"
            defaultValue={d.visibility ?? "private"}
            className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
          >
            <option value="public">전체 공개</option>
            <option value="members">회원 공개</option>
            <option value="private">비공개(초안)</option>
          </select>
        </label>
        {state?.message && (
          <p role="alert" className="text-sm text-red-600">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background w-fit rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "저장 중…" : submitLabel}
        </button>
      </form>
      <ToastViewport toasts={toasts} />
    </>
  );
}

const inputCls = INPUT_CLASS;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error.join(" ")}
        </p>
      )}
    </div>
  );
}
