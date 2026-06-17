"use client";
import { INPUT_CLASS, PRIMARY_BTN } from "@/lib/ui";
import { useActionState } from "react";
import Link from "next/link";
import { signin, type SigninState } from "./actions";
import TurnstileWidget, { useTurnstileReset } from "@/app/turnstile-widget";

const inputCls = INPUT_CLASS;

export default function SigninForm({ siteKey }: { siteKey?: string }) {
  const [state, action, pending] = useActionState<SigninState, FormData>(
    signin,
    undefined,
  );
  useTurnstileReset(state);
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputCls}
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <TurnstileWidget siteKey={siteKey} />
      <button
        type="submit"
        disabled={pending}
        className={PRIMARY_BTN}
      >
        {pending ? "확인 중…" : "로그인"}
      </button>
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <Link href="/signup" className="underline">
          가입 신청
        </Link>
        <Link href="/forgot-password" className="underline">
          비밀번호를 잊으셨나요?
        </Link>
      </div>
    </form>
  );
}
