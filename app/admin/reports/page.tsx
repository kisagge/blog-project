import Link from "next/link";
import { listReportQueue, listHiddenTargets } from "@/lib/reports";
import { REPORT_REASONS } from "@/lib/report-reasons";
import ReportActionButtons from "./report-actions-buttons";

export const dynamic = "force-dynamic";

function kst(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

// 댓글은 해당 댓글로 딥링크(?c=), 글은 상세로.
function targetHref(targetType: string, slug: string, targetId: string) {
  return targetType === "comment"
    ? `/feed/${slug}?c=${targetId}`
    : `/feed/${slug}`;
}

export default async function AdminReportsPage() {
  const [queue, hidden] = await Promise.all([
    listReportQueue(),
    listHiddenTargets(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold tracking-tight">
          대기 중인 신고 ({queue.length})
        </h1>
        {queue.length === 0 ? (
          <p className="text-sm text-zinc-400">처리할 신고가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.map((q) => (
              <li
                key={`${q.targetType}:${q.targetId}`}
                className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500">
                      {q.targetType === "comment" ? "댓글" : "글"} · 신고{" "}
                      {q.reportCount}건 · 최초 {kst(q.firstReportedAt)}
                    </p>
                    <Link
                      href={targetHref(q.targetType, q.slug, q.targetId)}
                      className="mt-1 block truncate text-sm font-medium hover:underline"
                    >
                      {q.preview || "(내용 없음)"}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      작성자{" "}
                      {q.authorId ? (
                        <Link
                          href={`/u/${q.authorId}`}
                          className="hover:underline"
                        >
                          {q.authorNickname}
                        </Link>
                      ) : (
                        q.authorNickname
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {q.reasons.map((r) => (
                        <span
                          key={r}
                          className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        >
                          {REPORT_REASONS[r]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <ReportActionButtons
                      targetType={q.targetType}
                      targetId={q.targetId}
                      slug={q.slug}
                      kind="pending"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          가려진 콘텐츠 ({hidden.length})
        </h2>
        {hidden.length === 0 ? (
          <p className="text-sm text-zinc-400">가려진 콘텐츠가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {hidden.map((h) => (
              <li
                key={`${h.targetType}:${h.targetId}`}
                className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500">
                      {h.targetType === "comment" ? "댓글" : "글"} · 숨김{" "}
                      {kst(h.hiddenAt)}
                    </p>
                    <Link
                      href={targetHref(h.targetType, h.slug, h.targetId)}
                      className="mt-1 block truncate text-sm font-medium hover:underline"
                    >
                      {h.preview || "(내용 없음)"}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      작성자{" "}
                      {h.authorId ? (
                        <Link
                          href={`/u/${h.authorId}`}
                          className="hover:underline"
                        >
                          {h.authorNickname}
                        </Link>
                      ) : (
                        h.authorNickname
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <ReportActionButtons
                      targetType={h.targetType}
                      targetId={h.targetId}
                      slug={h.slug}
                      kind="hidden"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
