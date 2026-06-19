"use client";
import { useActionState } from "react";
import { INPUT_CLASS, PRIMARY_BTN } from "@/lib/ui";
import type { SeriesFormState } from "./actions";

export default function SeriesForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (
    state: SeriesFormState,
    formData: FormData,
  ) => Promise<SeriesFormState>;
  defaultValues?: {
    title?: string;
    slug?: string;
    description?: string | null;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<
    SeriesFormState,
    FormData
  >(action, undefined);
  const d = defaultValues ?? {};
  const err = state?.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-zinc-500">제목</span>
        <input
          name="title"
          defaultValue={d.title ?? ""}
          className={INPUT_CLASS}
        />
        {err.title && (
          <span className="text-xs text-red-600">{err.title[0]}</span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-zinc-500">slug (소문자·숫자·하이픈)</span>
        <input
          name="slug"
          defaultValue={d.slug ?? ""}
          className={INPUT_CLASS}
        />
        {err.slug && (
          <span className="text-xs text-red-600">{err.slug[0]}</span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-zinc-500">설명 (선택)</span>
        <textarea
          name="description"
          defaultValue={d.description ?? ""}
          rows={2}
          className={`${INPUT_CLASS} resize-y`}
        />
      </label>
      {state?.message && (
        <p role="alert" className="text-red-600">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`${PRIMARY_BTN} w-fit`}
      >
        {pending ? "저장 중…" : submitLabel}
      </button>
    </form>
  );
}
