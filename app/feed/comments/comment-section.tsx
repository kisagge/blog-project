"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CommentNode, CommentSort } from "@/lib/comments";
import { ToastViewport, useToast } from "@/app/toast";
import { prefersReducedMotion } from "@/lib/motion";
import { useFeedEvent } from "../feed-events-context";
import CommentForm from "./comment-form";
import CommentItem from "./comment-item";
import {
  applyCreated,
  applyDeleted,
  applyEdited,
  applyLikeCount,
  applyReaction,
  appendLoaded,
} from "./merge";
import {
  deleteCommentAction,
  loadMoreCommentsAction,
  resyncCommentsAction,
} from "./comment-actions";

export default function CommentSection({
  feedId,
  slug,
  sort,
  canParticipate,
  actorUserId,
  isAdmin,
  linkAuthors,
  initialItems,
  initialTotal,
  initialHighlightId,
}: {
  feedId: string;
  slug: string;
  sort: CommentSort;
  canParticipate: boolean;
  actorUserId?: string;
  isAdmin: boolean;
  linkAuthors: boolean;
  initialItems: CommentNode[];
  initialTotal: number;
  initialHighlightId?: string;
}) {
  // items + total을 한 상태로 묶어 merge 헬퍼(낙관적·SSE 공용)가 원자적으로 갱신.
  const [tree, setTree] = useState({
    items: initialItems,
    total: initialTotal,
  });
  const { items, total } = tree;
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [loadingMore, startMore] = useTransition();
  const [, startDelete] = useTransition();
  // 알림 딥링크(?c=)로 들어오면 마운트 시 해당 댓글로 스크롤·하이라이트.
  const pendingScroll = useRef<string | null>(initialHighlightId ?? null);
  const { toasts, show } = useToast();

  const confirmRef = useRef<HTMLDialogElement>(null);
  const deleteIdRef = useRef<string | null>(null);

  const hasMore = items.length < total;

  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    pendingScroll.current = null;
    requestAnimationFrame(() => {
      const el = document.getElementById(`comment-${id}`);
      if (el) {
        el.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "center",
        });
        setHighlightId(id);
      } else {
        // 삭제됐거나(답글 없는 댓글 hard delete) 현재 페이지에 없는 댓글로의 딥링크.
        show("삭제되었거나 찾을 수 없는 댓글입니다.");
      }
    });
    const t = setTimeout(() => setHighlightId(null), 1600);
    return () => clearTimeout(t);
  }, [items, show]);

  // 실시간(SSE): 같은 글을 보는 다른 뷰어의 댓글·삭제를 트리에 병합(피드 연결 공유).
  // 본인 낙관적 삽입은 applyCreated의 id dedup으로 중복 흡수. 원격 이벤트는 스크롤 없음.
  // feedLike(글 좋아요)는 좋아요 버튼 몫이라 무시. (끊긴 동안 생성분은 새로고침/더보기로 재동기화.)
  useFeedEvent((ev) => {
    // 재접속: 끊긴 동안의 유실을 메우려 현재 로드량만큼 다시 받아 트리 교체(스크롤 없음).
    if (ev.kind === "resync") {
      // 로드량만큼(액션이 최소 한 페이지로 하한 보정) 다시 받아 트리 교체.
      // 리페치 await 중 도착한 라이브 이벤트가 직후 결과로 덮일 수 있으나(창이 짧음),
      // 다음 이벤트/재접속/더보기로 자가복구 — 기존 v1 한계와 동급으로 수용.
      void resyncCommentsAction(feedId, sort, items.length).then((page) =>
        setTree({ items: page.items, total: page.total }),
      );
      return;
    }
    // 글 좋아요·리액션은 각 버튼 몫이라 댓글 트리에선 무시.
    if (ev.kind === "feedLike" || ev.kind === "feedReaction") return;
    setTree((t) => {
      if (ev.kind === "created")
        return applyCreated(t.items, t.total, ev.parentId, ev.node);
      if (ev.kind === "edited")
        return applyEdited(t.items, t.total, ev.id, ev.content);
      if (ev.kind === "likeCount")
        return applyLikeCount(t.items, t.total, ev.id, ev.count);
      if (ev.kind === "reaction")
        return applyReaction(t.items, t.total, ev.id, ev.emoji, ev.count);
      return applyDeleted(t.items, t.total, ev.id);
    });
  });

  function focusAfterRender(id: string) {
    pendingScroll.current = id;
  }

  // 본인 작성분: 트리에 병합 + 해당 댓글로 스크롤.
  function onCreatedTop(comment: CommentNode) {
    setTree((t) => applyCreated(t.items, t.total, null, comment));
    focusAfterRender(comment.id);
  }

  function onCreatedReply(parentId: string, reply: CommentNode) {
    setTree((t) => applyCreated(t.items, t.total, parentId, reply));
    focusAfterRender(reply.id);
  }

  function onEdited(id: string, content: string) {
    setTree((t) => applyEdited(t.items, t.total, id, content));
  }

  function requestDelete(id: string) {
    deleteIdRef.current = id;
    confirmRef.current?.showModal();
  }

  function confirmDelete() {
    const id = deleteIdRef.current;
    confirmRef.current?.close();
    if (!id) return;
    deleteIdRef.current = null;

    setTree((t) => applyDeleted(t.items, t.total, id));
    startDelete(() => deleteCommentAction(id, feedId, slug));
    show("댓글이 삭제되었습니다.", "success");
  }

  function loadMore() {
    startMore(async () => {
      const res = await loadMoreCommentsAction(feedId, sort, items.length);
      // 실시간으로 이미 들어온 댓글이 다음 페이지에 중복으로 올 수 있어 dedup.
      setTree((t) => ({
        items: appendLoaded(t.items, res.items),
        total: res.total,
      }));
    });
  }

  return (
    <>
      <div className="mt-8 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">댓글 {total}</h2>
        <div
          role="group"
          aria-label="댓글 정렬"
          className="inline-flex rounded-full border border-black/15 p-0.5 text-sm dark:border-white/20"
        >
          <SortLink slug={slug} value="popular" current={sort} label="인기순" />
          <SortLink slug={slug} value="newest" current={sort} label="최신순" />
        </div>
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
              linkAuthors={linkAuthors}
              highlightId={highlightId}
              initialHighlightId={initialHighlightId}
              onRequestDelete={requestDelete}
              onCreatedReply={onCreatedReply}
              onEdited={onEdited}
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

      <dialog
        ref={confirmRef}
        className="bg-background text-foreground m-auto w-[min(90vw,22rem)] rounded-lg border border-black/15 p-5 shadow-xl backdrop:bg-black/40 dark:border-white/20"
      >
        <h2 className="text-base font-semibold">댓글을 삭제할까요?</h2>
        <p className="mt-2 text-sm text-zinc-500">
          삭제한 댓글은 되돌릴 수 없습니다.
        </p>
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => confirmRef.current?.close()}
            className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
          >
            취소
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            className="rounded bg-red-600 px-3 py-1.5 font-medium text-white"
          >
            삭제
          </button>
        </div>
      </dialog>

      <ToastViewport toasts={toasts} />
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
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-3 py-1 ${
        active
          ? "bg-zinc-900 font-medium text-white dark:bg-white dark:text-zinc-900"
          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      }`}
    >
      {label}
    </Link>
  );
}
