import Link from "next/link";
import type { FeedCard } from "./feed-card";

// 피드 목록 카드(제목·요약·작성자·날짜·조회수·태그). 공개 목록(FeedList)·저장 목록 공용.
// linkAuthors=false면 작성자 닉네임을 평문으로(비회원 뷰어). basePath는 태그 필터 링크 기준.
export default function FeedCardItem({
  card,
  linkAuthors = true,
  basePath = "/feed",
}: {
  card: FeedCard;
  linkAuthors?: boolean;
  basePath?: string;
}) {
  return (
    <li className="border-b border-black/[.06] pb-6 dark:border-white/[.1]">
      {/* 카드 링크는 제목·요약만 감싼다(작성자 프로필 링크와 앵커 중첩 방지). */}
      <Link href={`/feed/${card.slug}`} className="group block">
        <h2 className="text-xl font-medium tracking-tight group-hover:underline">
          {card.title}
        </h2>
        {card.summary && (
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {card.summary}
          </p>
        )}
      </Link>
      <p className="mt-2 text-sm text-zinc-500">
        {card.visibility === "private" && (
          <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            비공개
          </span>
        )}
        {card.authorName &&
          (card.authorId && linkAuthors ? (
            <span>
              <Link href={`/u/${card.authorId}`} className="hover:underline">
                {card.authorName}
              </Link>{" "}
              ·{" "}
            </span>
          ) : (
            <span>{card.authorName} · </span>
          ))}
        <time dateTime={card.createdAt}>
          {new Date(card.createdAt).toLocaleDateString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}
        </time>
        <span> · 조회 {card.viewCount.toLocaleString()}</span>
      </p>
      {card.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.tags.map((t) => (
            <Link
              key={t.slug}
              href={`${basePath}?tag=${encodeURIComponent(t.slug)}`}
              className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
            >
              #{t.name}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}
