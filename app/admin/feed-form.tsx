"use client";
import { useActionState } from "react";
import type { FeedFormState } from "@/app/admin/actions";

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

export default function FeedForm({ action, defaultValues, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<FeedFormState, FormData>(action, undefined);
  const d = defaultValues ?? {};
  const err = state?.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="제목" error={err.title}>
        <input name="title" defaultValue={d.title} className={inputCls} />
      </Field>
      <Field label="slug (소문자·숫자·하이픈)" error={err.slug}>
        <input name="slug" defaultValue={d.slug} className={inputCls} />
      </Field>
      <Field label="요약 (선택)" error={err.summary}>
        <input name="summary" defaultValue={d.summary ?? ""} className={inputCls} />
      </Field>
      <Field label="본문 (마크다운)" error={err.content}>
        <textarea name="content" defaultValue={d.content} rows={12} className={inputCls} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={d.published} />
        공개
      </label>
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button type="submit" disabled={pending} className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50">
        {pending ? "저장 중…" : submitLabel}
      </button>
    </form>
  );
}

const inputCls = "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

function Field({ label, error, children }: { label: string; error?: string[]; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-sm text-red-600">{error.join(" ")}</p>}
    </div>
  );
}
