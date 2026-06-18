import Link from "next/link";
import { listReportQueue, countHiddenTargets } from "@/lib/reports";
import { REPORT_REASONS } from "@/lib/report-reasons";
import ReportActionButtons from "./report-actions-buttons";
import ReportTabs from "./report-tabs";
import { targetHref } from "./helpers";
import { kstDateTime } from "@/lib/kst";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const [queue, hiddenCount] = await Promise.all([
    listReportQueue(),
    countHiddenTargets(),
  ]);

  return (
    <div>
      <ReportTabs
        active="queue"
        queueCount={queue.length}
        hiddenCount={hiddenCount}
      />
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
                    {q.reportCount}건 · 최초 {kstDateTime(q.firstReportedAt)}
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
                      <Link href={`/u/${q.authorId}`} className="hover:underline">
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
    </div>
  );
}
