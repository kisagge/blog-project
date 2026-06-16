import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 공개 상세와 미리보기가 공유하는 글 렌더(제목·작성일·마크다운 본문).
export default function FeedArticle({
  feed,
  authorName,
  tags = [],
}: {
  feed: {
    title: string;
    createdAt: Date;
    content: string;
    viewCount?: number;
  };
  authorName?: string;
  tags?: { name: string; slug: string }[];
}) {
  return (
    <article>
      <header className="mb-8 border-b border-black/[.06] pb-6 dark:border-white/[.1]">
        <h1 className="text-3xl font-semibold tracking-tight">{feed.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {authorName && <span>{authorName} · </span>}
          <time dateTime={feed.createdAt.toISOString()}>
            {feed.createdAt.toLocaleDateString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}
          </time>
          {typeof feed.viewCount === "number" && (
            <span> · 조회 {feed.viewCount.toLocaleString()}</span>
          )}
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
      <div className="flex flex-col gap-4 leading-7 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 dark:[&_code]:bg-zinc-800 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded [&_li]:ml-5 [&_li]:list-disc [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {feed.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
