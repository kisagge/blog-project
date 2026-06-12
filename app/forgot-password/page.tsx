import RequestForm from "./request-form";

export const metadata = { title: "비밀번호 찾기" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">비밀번호 찾기</h1>
      <p className="-mt-4 text-sm text-zinc-500">
        가입한 이메일로 6자리 인증 코드를 보내드립니다.
      </p>
      <RequestForm />
    </main>
  );
}
