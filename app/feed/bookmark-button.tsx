"use client";
import { useLoginPrompt } from "./login-prompt";
import { useOptimisticToggle } from "@/app/ui/use-optimistic-toggle";
import { toggleBookmarkAction } from "./bookmark-actions";

// 글 저장(북마크) 토글 버튼. 좋아요 버튼과 동형이되 개인용이라 공개 카운트·실시간(SSE) 없음.
export default function BookmarkButton({
  feedId,
  slug,
  initialBookmarked,
  canParticipate,
}: {
  feedId: string;
  slug: string;
  initialBookmarked: boolean;
  canParticipate: boolean;
}) {
  const promptLogin = useLoginPrompt();
  // 실패(429 등) 시 표시를 되돌림(예전엔 실패해도 "저장됨"으로 남았음).
  const bookmark = useOptimisticToggle(initialBookmarked, () =>
    toggleBookmarkAction(feedId, slug),
  );
  const bookmarked = bookmark.on;

  return (
    <button
      type="button"
      onClick={() => (canParticipate ? bookmark.toggle() : promptLogin())}
      aria-pressed={bookmarked}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${bookmarked ? "border-amber-300 text-amber-600" : "border-black/15 text-zinc-600 dark:border-white/20 dark:text-zinc-300"}`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill={bookmarked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
      </svg>
      {bookmarked ? "저장됨" : "저장"}
    </button>
  );
}
