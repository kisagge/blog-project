import Link from "next/link";

export default function FeedNotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">글을 찾을 수 없습니다</h1>
      <p className="mt-2 text-zinc-500">없는 글이거나 비공개 글입니다.</p>
      <Link href="/feed" className="mt-6 inline-block text-sm underline">
        피드로 돌아가기
      </Link>
    </main>
  );
}
