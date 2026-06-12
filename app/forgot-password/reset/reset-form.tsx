"use client";
import { useActionState } from "react";
import { submitNewPassword, type ResetState } from "../actions";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

export default function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    submitNewPassword,
    undefined,
  );
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <Field
        label="새 비밀번호"
        name="password"
        error={state?.errors?.password}
      />
      <p className="-mt-2 text-xs text-zinc-500">
        8자 이상, 소문자·대문자·숫자·특수문자를 각 1개 이상 포함하세요.
      </p>
      <Field
        label="새 비밀번호 확인"
        name="confirm"
        error={state?.errors?.confirm}
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "변경 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  error,
}: {
  label: string;
  name: string;
  error?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        autoComplete="new-password"
        className={inputCls}
      />
      {error && <p className="text-sm text-red-600">{error.join(" ")}</p>}
    </div>
  );
}
