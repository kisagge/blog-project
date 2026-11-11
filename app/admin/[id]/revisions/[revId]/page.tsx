import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeedById } from "@/lib/feeds";
import { getRevision } from "@/lib/revisions";
import { isoInstant, kstDateTime } from "@/lib/kst";
import { diffStats, lineDiff } from "@/lib/text-diff";
import DiffView from "@/app/admin/diff-view";
import RestoreButton from "../restore-button";

export const metadata = { title: "이력 비교 · 관리자" };
export const dynamic = "force-dynamic";

// 이력 한 건과 현재 글 비교(이 버전 → 현재) + 되돌리기. 관리자 레이아웃이 세션 가드.
export default async function RevisionPage({
  params,
}: {
  params: Promise<{ id: string; revId: string }>;
}) {
  const { id, revId } = await params;
  const [feed, rev] = await Promise.all([getFeedById(id), getRevision(revId)]);
  if (!feed || !rev || rev.feedId !== id) notFound();

  const rows = lineDiff(rev.content, feed.content);
  const { added, removed } = diffStats(rows);
  const titleChanged = rev.title !== feed.title;
  const summaryChanged = (rev.summary ?? "") !== (feed.summary ?? "");

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">이력 비교</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/${id}/revisions`}
            className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
          >
            목록
          </Link>
          <RestoreButton revisionId={rev.id} />
        </div>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <time dateTime={isoInstant(rev.createdAt)}>
          {kstDateTime(rev.createdAt)}
        </time>
        까지의 버전 → 현재 글. 되돌리면 아래 변경이 취소됩니다.
      </p>

      <section aria-labelledby="rev-meta">
        <h2 id="rev-meta" className="mb-2 text-sm font-semibold">
          제목·요약
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400">제목</dt>
          <dd>
            {titleChanged
              ? `${rev.title} → ${feed.title}`
              : `${feed.title} (변경 없음)`}
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">요약</dt>
          <dd>
            {summaryChanged
              ? `${rev.summary || "(없음)"} → ${feed.summary || "(없음)"}`
              : "변경 없음"}
          </dd>
        </dl>
      </section>

      <section aria-labelledby="rev-body">
        <h2 id="rev-body" className="mb-2 text-sm font-semibold">
          본문{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            (추가 {added}줄 · 삭제 {removed}줄)
          </span>
        </h2>
        <DiffView rows={rows} />
      </section>
    </section>
  );
}
