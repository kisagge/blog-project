"use client";
import { useActionState } from "react";
import { INPUT_CLASS, PRIMARY_BTN } from "@/lib/ui";
import type { SeriesFormState } from "./actions";
import FormField from "@/app/ui/form-field";

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
  // 실패 응답의 제출값이 있으면 그것으로(폼 초기화 후 입력 유지), 없으면 초기값.
  const d = { ...defaultValues, ...state?.values };
  const err = state?.errors ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3 text-sm">
      <FormField
        id="series-title"
        label="제목"
        error={err.title}
        labelClassName="text-zinc-500"
      >
        {(control) => (
          <input
            {...control}
            name="title"
            defaultValue={d.title ?? ""}
            className={INPUT_CLASS}
          />
        )}
      </FormField>
      <FormField
        id="series-slug"
        label="slug (소문자·숫자·하이픈)"
        error={err.slug}
        labelClassName="text-zinc-500"
      >
        {(control) => (
          <input
            {...control}
            name="slug"
            defaultValue={d.slug ?? ""}
            className={INPUT_CLASS}
          />
        )}
      </FormField>
      <FormField
        id="series-description"
        label="설명 (선택)"
        error={err.description}
        labelClassName="text-zinc-500"
      >
        {(control) => (
          <textarea
            {...control}
            name="description"
            defaultValue={d.description ?? ""}
            rows={2}
            className={`${INPUT_CLASS} resize-y`}
          />
        )}
      </FormField>
      {state?.error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {state.error}
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
