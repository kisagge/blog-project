"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadFeeds, type FeedCard } from "./actions";

type Props = {
  initialItems: FeedCard[];
  initialHasMore: boolean;
  initialQuery: string;
};

export default function FeedList({
  initialItems,
  initialHasMore,
  initialQuery,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);

  // 최신 상태를 옵저버/비동기 콜백에서 참조하기 위한 ref(스테일 클로저 방지)
  const reqIdRef = useRef(0); // 검색이 바뀔 때마다 증가 → 지난 요청 결과를 폐기
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(initialHasMore);
  const itemsLenRef = useRef(initialItems.length);
  const queryRef = useRef(initialQuery);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  useEffect(() => {
    itemsLenRef.current = items.length;
  }, [items.length]);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  // 검색어 변경 → 300ms 디바운스 후 목록 리셋 조회. 첫 마운트는 SSR 데이터가 있으니 건너뜀.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      setLoading(true);
      loadingRef.current = true;
      const url = query.trim()
        ? `/feed?q=${encodeURIComponent(query.trim())}`
        : "/feed";
      window.history.replaceState(null, "", url);
      const res = await loadFeeds(query, 0);
      if (myReq !== reqIdRef.current) return; // 더 최신 검색이 진행 중이면 폐기
      setItems(res.items);
      setHasMore(res.hasMore);
      setLoading(false);
      loadingRef.current = false;
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    const myReq = reqIdRef.current;
    setLoading(true);
    loadingRef.current = true;
    const res = await loadFeeds(queryRef.current, itemsLenRef.current);
    if (myReq !== reqIdRef.current) return; // 로드 중 검색이 바뀌면 폐기
    setItems((prev) => [...prev, ...res.items]);
    setHasMore(res.hasMore);
    setLoading(false);
    loadingRef.current = false;
  }, []);

  // 화면 하단 센티넬이 보이면 다음 페이지 로드
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <>
      <div className="relative mb-8">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목·내용 검색"
          aria-label="피드 검색"
          className="w-full rounded-lg border border-black/15 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>

      {items.length === 0 && !loading ? (
        <p className="text-zinc-500">
          {query.trim()
            ? `‘${query.trim()}’에 대한 결과가 없습니다.`
            : "아직 공개된 글이 없습니다."}
        </p>
      ) : (
        <ul className="flex flex-col gap-6">
          {items.map((feed) => (
            <li
              key={feed.slug}
              className="border-b border-black/[.06] pb-6 dark:border-white/[.1]"
            >
              <Link href={`/feed/${feed.slug}`} className="group block">
                <h2 className="text-xl font-medium tracking-tight group-hover:underline">
                  {feed.title}
                </h2>
                {feed.summary && (
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    {feed.summary}
                  </p>
                )}
                <p className="mt-2 text-sm text-zinc-500">
                  {feed.visibility === "private" && (
                    <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      비공개
                    </span>
                  )}
                  <time dateTime={feed.createdAt}>
                    {new Date(feed.createdAt).toLocaleDateString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </time>
                  <span> · 조회 {feed.viewCount.toLocaleString()}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* 무한스크롤 트리거 */}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {loading && (
        <p className="mt-6 text-center text-sm text-zinc-500">불러오는 중…</p>
      )}
      {!hasMore && items.length > 0 && (
        <p className="mt-6 text-center text-sm text-zinc-400">
          마지막 글입니다.
        </p>
      )}
    </>
  );
}
