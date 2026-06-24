"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadFeeds } from "./actions";
import type { FeedCard } from "./feed-card";
import FeedCardItem from "./feed-card-item";
import FeedCardSkeleton from "./feed-card-skeleton";

type Sort = "latest" | "popular";

type Props = {
  initialItems: FeedCard[];
  initialHasMore: boolean;
  initialQuery: string;
  author?: "admin" | "member"; // 어느 목록인지(관리자 글/회원 글) — 무한스크롤에도 전달
  initialTag?: string; // 태그 slug 필터(URL ?tag=). 변경 시 page에서 key로 remount.
  linkAuthors?: boolean; // 비회원(anon) 뷰어에겐 false → 작성자 닉네임 평문(막다른 프로필 링크 제거).
  initialSort?: Sort; // 정렬(URL ?sort=). 기본 최신순.
  showSort?: boolean; // 정렬 토글 노출 여부(커뮤니티만). 미노출이면 정렬 미전달=현행 동작.
};

export default function FeedList({
  initialItems,
  initialHasMore,
  initialQuery,
  author,
  initialTag,
  linkAuthors = true,
  initialSort = "latest",
  showSort = false,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<Sort>(initialSort);
  const [loading, setLoading] = useState(false);
  const basePath = author === "member" ? "/community" : "/feed";
  const tag = initialTag; // 마운트 동안 고정(태그 변경은 key remount로 처리)
  // 정렬 토글이 없으면 서버 기본 동작 유지(undefined 전달).
  const sortParam: Sort | undefined = showSort ? sort : undefined;

  // 최신 상태를 옵저버/비동기 콜백에서 참조하기 위한 ref(스테일 클로저 방지)
  const reqIdRef = useRef(0); // 검색이 바뀔 때마다 증가 → 지난 요청 결과를 폐기
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(initialHasMore);
  const itemsLenRef = useRef(initialItems.length);
  const queryRef = useRef(initialQuery);
  const sortRef = useRef(sortParam);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  useEffect(() => {
    itemsLenRef.current = items.length;
  }, [items.length]);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);
  useEffect(() => {
    sortRef.current = sortParam;
  }, [sortParam]);

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
      if (sortParam === "popular") params.set("sort", "popular");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${basePath}?${qs}` : basePath,
      );
      const res = await loadFeeds(query, 0, author, tag, sortParam);
      if (myReq !== reqIdRef.current) return; // 더 최신 검색이 진행 중이면 폐기
      setItems(res.items);
      setHasMore(res.hasMore);
      setLoading(false);
      loadingRef.current = false;
    }, 300);
    return () => clearTimeout(t);
  }, [query, author, basePath, tag, sortParam]);

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
      sortRef.current,
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
      <div className="relative mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목·내용 검색"
          aria-label="피드 검색"
          className="w-full rounded-lg border border-black/15 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>
      {showSort && (
        <div
          role="group"
          aria-label="정렬"
          className="mb-8 inline-flex rounded-full border border-black/15 p-0.5 text-sm dark:border-white/20"
        >
          {(["latest", "popular"] as const).map((s) => {
            const active = sort === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                aria-current={active ? "true" : undefined}
                className={`rounded-full px-3 py-1 ${
                  active
                    ? "bg-zinc-900 font-medium text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {s === "latest" ? "최신순" : "인기순"}
              </button>
            );
          })}
        </div>
      )}

      {items.length === 0 && !loading ? (
        <p className="text-zinc-500">
          {query.trim()
            ? `‘${query.trim()}’에 대한 결과가 없습니다.`
            : "아직 공개된 글이 없습니다."}
        </p>
      ) : (
        <ul className="flex flex-col gap-6">
          {items.map((feed) => (
            <FeedCardItem
              key={feed.slug}
              card={feed}
              linkAuthors={linkAuthors}
              basePath={basePath}
              highlightQuery={query}
            />
          ))}
        </ul>
      )}

      {/* 무한스크롤 트리거 */}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {loading && (
        <>
          <p role="status" className="sr-only">
            불러오는 중…
          </p>
          <ul className="mt-6 flex flex-col gap-6" aria-hidden>
            <FeedCardSkeleton />
            <FeedCardSkeleton />
          </ul>
        </>
      )}
      {!hasMore && items.length > 0 && (
        <p className="mt-6 text-center text-sm text-zinc-400">
          마지막 글입니다.
        </p>
      )}
    </>
  );
}
