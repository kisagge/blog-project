"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadFeeds } from "./actions";
import type { FeedCard } from "./feed-card";

type Props = {
  initialItems: FeedCard[];
  initialHasMore: boolean;
  initialQuery: string;
  author?: "admin" | "member"; // 어느 목록인지(관리자 글/회원 글) — 무한스크롤에도 전달
  initialTag?: string; // 태그 slug 필터(URL ?tag=). 변경 시 page에서 key로 remount.
};

export default function FeedList({
  initialItems,
  initialHasMore,
  initialQuery,
  author,
  initialTag,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const basePath = author === "member" ? "/community" : "/feed";
  const tag = initialTag; // 마운트 동안 고정(태그 변경은 key remount로 처리)

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
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (tag) params.set("tag", tag);
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${basePath}?${qs}` : basePath);
      const res = await loadFeeds(query, 0, author, tag);
      if (myReq !== reqIdRef.current) return; // 더 최신 검색이 진행 중이면 폐기
      setItems(res.items);
      setHasMore(res.hasMore);
      setLoading(false);
      loadingRef.current = false;
    }, 300);
    return () => clearTimeout(t);
  }, [query, author, basePath, tag]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    const myReq = reqIdRef.current;
    setLoading(true);
    loadingRef.current = true;
    const res = await loadFeeds(
      queryRef.current,
      itemsLenRef.current,
      author,
      tag,
    );
    if (myReq !== reqIdRef.current) return; // 로드 중 검색이 바뀌면 폐기
    setItems((prev) => [...prev, ...res.items]);
    setHasMore(res.hasMore);
    setLoading(false);
    loadingRef.current = false;
  }, [author, tag]);

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
      {tag && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-zinc-500">태그</span>
          <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            #{tag}
          </span>
          <Link
            href={basePath}
            aria-label="태그 필터 해제"
            className="text-zinc-500 hover:underline"
          >
            ✕ 해제
          </Link>
        </div>
      )}
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
                  {feed.authorName && <span>{feed.authorName} · </span>}
                  <time dateTime={feed.createdAt}>
                    {new Date(feed.createdAt).toLocaleDateString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </time>
                  <span> · 조회 {feed.viewCount.toLocaleString()}</span>
                </p>
              </Link>
              {feed.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {feed.tags.map((t) => (
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
