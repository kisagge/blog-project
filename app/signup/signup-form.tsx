"use client";
import { INPUT_CLASS, PRIMARY_BTN } from "@/lib/ui";
import { useActionState } from "react";
import Link from "next/link";
import { signup, type SignupState } from "./actions";
import TurnstileWidget from "@/app/turnstile-widget";
import FormField from "@/app/ui/form-field";
import { PASSWORD_HINT } from "@/lib/limits";

export default function SignupForm({ siteKey }: { siteKey?: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    signup,
    undefined,
  );
  if (state?.done) {
    return (
      <div className="w-full max-w-sm text-center">
        <p className="text-sm">
          가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          홈으로
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <FormField id="signup-email" label="이메일" error={state?.errors?.email}>
        {(control) => (
          <input
            {...control}
            name="email"
            type="email"
            autoComplete="email"
            className={INPUT_CLASS}
          />
        )}
      </FormField>
      <FormField
        id="signup-nickname"
        label="닉네임"
        error={state?.errors?.nickname}
      >
        {(control) => (
          <input
            {...control}
            name="nickname"
            autoComplete="nickname"
            className={INPUT_CLASS}
          />
        )}
      </FormField>
      <FormField
        id="signup-password"
        label="비밀번호"
        hint={PASSWORD_HINT}
        error={state?.errors?.password}
      >
        {(control) => (
          <input
            {...control}
            name="password"
            type="password"
            autoComplete="new-password"
            className={INPUT_CLASS}
          />
        )}
      </FormField>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <TurnstileWidget siteKey={siteKey} resetSignal={state} />
      <button type="submit" disabled={pending} className={PRIMARY_BTN}>
        {pending ? "신청 중…" : "가입 신청"}
      </button>
      <p className="text-sm text-zinc-500">
        이미 회원이세요?{" "}
        <Link href="/signin" className="underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
