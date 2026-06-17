import Link from "next/link";
import { readingTimeMinutes, extractToc } from "@/lib/content";
import Toc from "@/app/feed/toc";
import MarkdownContent from "@/app/markdown-content";

// 공개 상세와 미리보기가 공유하는 글 렌더(제목·작성일·마크다운 본문).
export default function FeedArticle({
  feed,
  authorName,
  authorId,
  linkAuthors = true,
  tags = [],
}: {
  feed: {
    title: string;
    createdAt: Date;
    content: string;
    viewCount?: number;
  };
  authorName?: string;
  authorId?: string | null; // 회원 글이면 작성자 id(프로필 링크). 관리자 글은 null/undefined.
  linkAuthors?: boolean; // 비회원(anon) 뷰어에겐 false → 닉네임 평문(막다른 프로필 링크 제거).
  tags?: { name: string; slug: string }[];
}) {
  const minutes = readingTimeMinutes(feed.content);
  const toc = extractToc(feed.content);
  return (
    <article>
      <header className="mb-8 border-b border-black/[.06] pb-6 dark:border-white/[.1]">
        <h1 className="text-3xl font-semibold tracking-tight">{feed.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {authorName &&
            (authorId && linkAuthors ? (
              <span>
                <Link href={`/u/${authorId}`} className="hover:underline">
                  {authorName}
                </Link>{" "}
                ·{" "}
              </span>
            ) : (
              <span>{authorName} · </span>
            ))}
          <time dateTime={feed.createdAt.toISOString()}>
            {feed.createdAt.toLocaleDateString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}
          </time>
          {typeof feed.viewCount === "number" && (
            <span> · 조회 {feed.viewCount.toLocaleString()}</span>
          )}
          <span> · 약 {minutes}분</span>
        </p>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Link
                key={t.slug}
                href={`/feed?tag=${encodeURIComponent(t.slug)}`}
                className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
              >
                #{t.name}
              </Link>
            ))}
          </div>
        )}
      </header>
      <Toc items={toc} />
      <MarkdownContent content={feed.content} />
    </article>
  );
}
