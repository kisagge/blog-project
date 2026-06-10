import SignupForm from "./signup-form";

export const metadata = { title: "회원가입 · BY Playground" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
      <SignupForm />
    </main>
  );
}
