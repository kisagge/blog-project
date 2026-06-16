"use client";
import { useActionState, useEffect } from "react";
import Link from "next/link";
import { signup, type SignupState } from "./actions";
import TurnstileWidget from "@/app/turnstile-widget";

const inputCls =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

export default function SignupForm({ siteKey }: { siteKey?: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    signup,
    undefined,
  );
  // 검증 실패 시 위젯 토큰을 리셋(단일 사용 → 재시도 시 신규 토큰).
  useEffect(() => {
    if (state?.error) window.turnstile?.reset();
  }, [state]);
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
      <Field
        label="이메일"
        name="email"
        type="email"
        error={state?.errors?.email}
      />
      <Field label="닉네임" name="nickname" error={state?.errors?.nickname} />
      <Field
        label="비밀번호"
        name="password"
        type="password"
        error={state?.errors?.password}
      />
      <p className="-mt-3 text-xs text-zinc-500">
        8자 이상, 소문자·대문자·숫자·특수문자를 각 1개 이상 포함하세요.
      </p>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <TurnstileWidget siteKey={siteKey} />
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
      >
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

function Field({
  label,
  name,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input id={name} name={name} type={type} className={inputCls} />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error.join(" ")}
        </p>
      )}
    </div>
  );
}
