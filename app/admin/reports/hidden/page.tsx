import Link from "next/link";
import { listHiddenTargets, countPendingReportTargets } from "@/lib/reports";
import ReportActionButtons from "../report-actions-buttons";
import ReportTabs from "../report-tabs";
import { targetHref } from "../helpers";
import { kstDateTime } from "@/lib/kst";

export const dynamic = "force-dynamic";

export default async function AdminHiddenReportsPage() {
  const [hidden, queueCount] = await Promise.all([
    listHiddenTargets(),
    countPendingReportTargets(),
  ]);

  return (
    <div>
      <ReportTabs
        active="hidden"
        queueCount={queueCount}
        hiddenCount={hidden.length}
      />
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
                    {kstDateTime(h.hiddenAt)}
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
    </div>
  );
}
