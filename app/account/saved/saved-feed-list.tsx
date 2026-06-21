"use client";
import { useState, useTransition } from "react";
import FeedCardItem from "@/app/feed/(list)/feed-card-item";
import type { FeedCard } from "@/app/feed/(list)/feed-card";
import { loadSavedFeeds } from "./actions";

// 저장한 글 목록 + "더보기"(무한스크롤 대신 버튼). 카드 마크업은 공용 FeedCardItem 재사용.
export default function SavedFeedList({
  initialItems,
  initialHasMore,
}: {
  initialItems: FeedCard[];
  initialHasMore: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, startLoad] = useTransition();

  function loadMore() {
    startLoad(async () => {
      const res = await loadSavedFeeds(items.length);
      // 로드 사이 저장/해제로 항목이 밀릴 수 있어 slug 기준 dedup(중복 키 방지).
      setItems((prev) => {
        const seen = new Set(prev.map((c) => c.slug));
        return [...prev, ...res.items.filter((c) => !seen.has(c.slug))];
      });
      setHasMore(res.hasMore);
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        저장한 글이 없습니다. 글 상세에서 저장하면 여기에 모입니다.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-6">
        {items.map((c) => (
          <FeedCardItem key={c.slug} card={c} />
        ))}
      </ul>
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-full border border-black/15 px-5 py-2 text-sm hover:bg-black/[.03] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/[.05]"
          >
            {loading ? "불러오는 중…" : "더보기"}
          </button>
        </div>
      )}
    </>
  );
}
