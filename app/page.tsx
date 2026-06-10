import Link from "next/link";
import { guardPublicAccess } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function Home() {
  await guardPublicAccess();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">BY Playground</h1>
      <p className="max-w-prose text-zinc-600 dark:text-zinc-400">
        생각과 기록을 남기는 개인 공간입니다.
      </p>
      <Link
        href="/feed"
        className="bg-foreground text-background w-fit rounded-full px-5 py-2.5 text-sm font-medium transition-colors hover:opacity-90"
      >
        피드 보기 →
      </Link>
    </main>
  );
}
