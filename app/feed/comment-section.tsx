"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CommentNode, CommentSort } from "@/lib/comments";
import CommentForm from "./comment-form";
import CommentItem from "./comment-item";
import { loadMoreCommentsAction } from "./comment-actions";

export default function CommentSection({
  feedId,
  slug,
  sort,
  canParticipate,
  actorUserId,
  isAdmin,
  initialItems,
  initialTotal,
}: {
  feedId: string;
  slug: string;
  sort: CommentSort;
  canParticipate: boolean;
  actorUserId?: string;
  isAdmin: boolean;
  initialItems: CommentNode[];
  initialTotal: number;
}) {
  const [items, setItems] = useState<CommentNode[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [loadingMore, startMore] = useTransition();
  const pendingScroll = useRef<string | null>(null);

  const hasMore = items.length < total;

  // 새로 추가/이동된 댓글로 스크롤 + 잠깐 하이라이트.
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    pendingScroll.current = null;
    requestAnimationFrame(() => {
      document
        .getElementById(`comment-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    setHighlightId(id);
    const t = setTimeout(() => setHighlightId(null), 1600);
    return () => clearTimeout(t);
  }, [items]);

  function focusAfterRender(id: string) {
    pendingScroll.current = id;
  }

  function onCreatedTop(comment: CommentNode) {
    setItems((prev) => [comment, ...prev]);
    setTotal((t) => t + 1);
    focusAfterRender(comment.id);
  }

  function onCreatedReply(parentId: string, reply: CommentNode) {
    setItems((prev) =>
      prev.map((c) =>
        c.id === parentId ? { ...c, replies: [...c.replies, reply] } : c,
      ),
    );
    focusAfterRender(reply.id);
  }

  function onDeleted(id: string) {
    const top = items.find((t) => t.id === id);
    if (top && top.replies.length === 0) setTotal((t) => t - 1); // 대댓글 없는 상위 → 완전 삭제
    setItems((prev) =>
      prev.flatMap((t) => {
        if (t.id === id)
          return t.replies.length > 0
            ? [{ ...t, deleted: true, content: "" }]
            : [];
        if (t.replies.some((r) => r.id === id))
          return [{ ...t, replies: t.replies.filter((r) => r.id !== id) }];
        return [t];
      }),
    );
  }

  function loadMore() {
    startMore(async () => {
      const res = await loadMoreCommentsAction(feedId, sort, items.length);
      setItems((prev) => [...prev, ...res.items]);
      setTotal(res.total);
    });
  }

  return (
    <>
      <div className="mt-8 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">댓글 {total}</h2>
        <nav className="flex gap-3 text-sm">
          <SortLink slug={slug} value="popular" current={sort} label="인기순" />
          <SortLink slug={slug} value="newest" current={sort} label="최신순" />
        </nav>
      </div>

      <div className="mb-6">
        <CommentForm
          feedId={feedId}
          slug={slug}
          canParticipate={canParticipate}
          onCreated={onCreatedTop}
        />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => (
            <CommentItem
              key={c.id}
              node={c}
              feedId={feedId}
              slug={slug}
              canParticipate={canParticipate}
              actorUserId={actorUserId}
              isAdmin={isAdmin}
              highlightId={highlightId}
              onDeleted={onDeleted}
              onCreatedReply={onCreatedReply}
            />
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-black/15 px-5 py-2 text-sm hover:bg-black/[.03] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/[.05]"
          >
            {loadingMore ? "불러오는 중…" : "댓글 더보기"}
          </button>
        </div>
      )}
    </>
  );
}

function SortLink({
  slug,
  value,
  current,
  label,
}: {
  slug: string;
  value: CommentSort;
  current: CommentSort;
  label: string;
}) {
  const active = current === value;
  return (
    <Link
      href={`/feed/${slug}?sort=${value}`}
      scroll={false}
      className={
        active
          ? "font-semibold"
          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      }
    >
      {label}
    </Link>
  );
}
