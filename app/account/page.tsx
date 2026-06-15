import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  listMyDrafts,
  listMyPosts,
  DRAFT_LIMIT,
} from "@/lib/member-posts";
import AccountForm from "./account-form";
import { deleteMyPostAction } from "./posts/actions";

export const metadata = { title: "내 정보" };

export default async function AccountPage() {
  const session = await getSession();
  if (session?.role !== "member") redirect("/signin");
  const [user, drafts, posts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, nickname: true },
    }),
    listMyDrafts(session.userId),
    listMyPosts(session.userId),
  ]);
  if (!user) redirect("/signin");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-12 px-6 py-16">
      <section className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">내 정보</h1>
        <AccountForm email={user.email} nickname={user.nickname} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">내 글</h2>
          <Link
            href="/account/posts/new"
            className="bg-foreground text-background rounded-full px-4 py-2 text-sm font-medium"
          >
            글쓰기
          </Link>
        </div>

        <h3 className="text-sm font-medium text-zinc-500">
          임시저장 {drafts.length}/{DRAFT_LIMIT}
        </h3>
        {drafts.length === 0 ? (
          <p className="text-sm text-zinc-400">임시저장한 글이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145]"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {d.title}
                </span>
                <span className="flex shrink-0 gap-2 text-sm">
                  <Link
                    href={`/account/posts/${d.id}/edit`}
                    className="text-zinc-600 hover:underline dark:text-zinc-300"
                  >
                    수정
                  </Link>
                  <DeleteButton id={d.id} label="임시저장 삭제" />
                </span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-2 text-sm font-medium text-zinc-500">회원공개</h3>
        {posts.length === 0 ? (
          <p className="text-sm text-zinc-400">게시한 글이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145]"
              >
                <Link
                  href={`/feed/${p.slug}`}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {p.title}
                </Link>
                <span className="flex shrink-0 items-center gap-2 text-sm text-zinc-500">
                  <span>조회 {p.viewCount.toLocaleString()}</span>
                  <Link
                    href={`/account/posts/${p.id}/edit`}
                    className="text-zinc-600 hover:underline dark:text-zinc-300"
                  >
                    수정
                  </Link>
                  <DeleteButton id={p.id} label="글 삭제" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function DeleteButton({ id, label }: { id: string; label: string }) {
  return (
    <form action={deleteMyPostAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={label}
        className="text-red-600 hover:underline"
      >
        삭제
      </button>
    </form>
  );
}
