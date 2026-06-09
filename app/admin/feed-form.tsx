"use client";
import { useActionState, useRef, useState } from "react";
import type { FeedFormState } from "@/app/admin/actions";
import { uploadImage } from "@/app/admin/upload-action";
import { ToastViewport, useToast } from "@/app/admin/toast";
import { checkImage } from "@/lib/upload";

type Props = {
  action: (state: FeedFormState, formData: FormData) => Promise<FeedFormState>;
  defaultValues?: {
    title?: string;
    slug?: string;
    summary?: string | null;
    content?: string;
    published?: boolean;
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
  const [uploading, setUploading] = useState(false);
  const { toasts, show } = useToast();

  function insertAtCursor(text: string) {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    const pos = start + text.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
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
      <form action={formAction} className="flex flex-col gap-5">
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
          <input
            type="checkbox"
            name="published"
            defaultChecked={d.published}
          />
          공개
        </label>
        {state?.message && (
          <p className="text-sm text-red-600">{state.message}</p>
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

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

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
      {error && <p className="text-sm text-red-600">{error.join(" ")}</p>}
    </div>
  );
}
