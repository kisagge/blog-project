import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/dal";
import { countMyDrafts, DRAFT_LIMIT } from "@/lib/member-posts";
import PostEditor from "../post-editor";

export const metadata = { title: "글쓰기" };

export default async function NewPostPage() {
  const session = await getSession();
  if (session?.role !== "member") redirect("/signin");
  const drafts = await countMyDrafts(session.userId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div>
        <Link href="/account" className="text-sm text-zinc-500 hover:underline">
          ← 내 정보
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">글쓰기</h1>
        <p className="mt-1 text-sm text-zinc-500">
          임시저장 {drafts}/{DRAFT_LIMIT} · 게시하면 회원에게 공개됩니다.
        </p>
      </div>
      <PostEditor />
    </main>
  );
}
