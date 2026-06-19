"use client";
import { INPUT_CLASS, PRIMARY_BTN } from "@/lib/ui";
import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

export default function LoginForm({
  otpEnabled = false,
}: {
  otpEnabled?: boolean;
}) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <label htmlFor="password" className="text-sm font-medium">
        비밀번호
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        className={INPUT_CLASS}
      />
      {otpEnabled && (
        <>
          <label htmlFor="code" className="text-sm font-medium">
            인증 코드 (Google Authenticator)
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            placeholder="6자리"
            required
            className="rounded border border-black/15 bg-transparent px-3 py-2 tracking-widest dark:border-white/20"
          />
        </>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={PRIMARY_BTN}>
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
