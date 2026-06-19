import { notFound } from "next/navigation";
import Link from "next/link";
import { getViewerRole } from "@/lib/dal";
import { getMemberProfile } from "@/lib/users";
import { listMemberPosts } from "@/lib/member-posts";
import { getCommentsByUser } from "@/lib/comments";
import { kstDate, isoInstant } from "@/lib/kst";
import MemberGate from "@/app/member-gate";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 회원공개 프로필이라 비회원에겐 닉네임을 제목으로도 노출하지 않음.
  if ((await getViewerRole()) === "anon") return { title: "회원 전용" };
  const profile = await getMemberProfile(id);
  return {
    title: profile ? `${profile.nickname} 님의 프로필` : "찾을 수 없음",
  };
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await getViewerRole();

  // 회원 콘텐츠(회원공개)라 비회원은 안내.
  if (role === "anon") {
    return (
      <MemberGate
        title="회원만 볼 수 있는 프로필입니다"
        backHref="/community"
        backLabel="커뮤니티"
      />
    );
  }

  const profile = await getMemberProfile(id);
  if (!profile) notFound(); // 없음 또는 비회원(예약 admin)

  const [posts, comments] = await Promise.all([
    listMemberPosts(id),
    getCommentsByUser(id, 20),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.nickname}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          가입{" "}
          <time dateTime={isoInstant(profile.createdAt)}>
            {kstDate(profile.createdAt)}
          </time>
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          작성 글 ({posts.length})
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm text-zinc-400">게시한 글이 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
            {posts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <Link
                  href={`/feed/${p.slug}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {p.title}
                </Link>
                <span className="shrink-0 text-zinc-500">
                  조회 {p.viewCount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">최근 댓글</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-zinc-400">작성한 댓글이 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
            {comments.map((c) => (
              <li key={c.id} className="py-2 text-sm">
                <Link href={`/feed/${c.feed.slug}`} className="group block">
                  <span className="line-clamp-2 text-zinc-700 group-hover:underline dark:text-zinc-300">
                    {c.content}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    ‘{c.feed.title}’ ·{" "}
                    <time dateTime={isoInstant(c.createdAt)}>
                      {kstDate(c.createdAt)}
                    </time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
