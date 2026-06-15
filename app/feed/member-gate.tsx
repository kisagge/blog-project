import Link from "next/link";

// 회원 공개 글에 비로그인 접근 시: 안내 + 로그인/가입 유도 + 다른(전체공개) 글.
export default function MemberGate({
  related,
}: {
  related: { slug: string; title: string }[];
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <div className="rounded-lg border border-black/[.08] p-8 text-center dark:border-white/[.145]">
        <h1 className="text-xl font-semibold tracking-tight">
          회원에게만 공개된 글입니다
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          로그인하거나 가입하면 이 글을 볼 수 있습니다.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/signin"
            className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-medium dark:border-white/20"
          >
            가입
          </Link>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-zinc-500">다른 글</h2>
          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
            {related.map((f) => (
              <li key={f.slug} className="py-2">
                <Link
                  href={`/feed/${f.slug}`}
                  className="text-sm hover:underline"
                >
                  {f.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-center">
        <Link href="/feed" className="text-sm text-zinc-500 underline">
          ← 피드 목록
        </Link>
      </p>
    </main>
  );
}
