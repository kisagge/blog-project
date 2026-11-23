"use client";
import { INPUT_CLASS, PRIMARY_BTN } from "@/lib/ui";
import { useActionState } from "react";
import { submitNewPassword, type ResetState } from "../actions";
import FormField, { type FieldControlProps } from "@/app/ui/form-field";
import { PASSWORD_HINT } from "@/lib/limits";

export default function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    submitNewPassword,
    undefined,
  );
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <FormField
        id="reset-password"
        label="새 비밀번호"
        hint={PASSWORD_HINT}
        error={state?.errors?.password}
      >
        {(control) => <PasswordInput {...control} name="password" />}
      </FormField>
      <FormField
        id="reset-confirm"
        label="새 비밀번호 확인"
        error={state?.errors?.confirm}
      >
        {(control) => <PasswordInput {...control} name="confirm" />}
      </FormField>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={PRIMARY_BTN}>
        {pending ? "변경 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}

function PasswordInput(props: FieldControlProps & { name: string }) {
  return (
    <input
      {...props}
      type="password"
      autoComplete="new-password"
      className={INPUT_CLASS}
    />
  );
}
