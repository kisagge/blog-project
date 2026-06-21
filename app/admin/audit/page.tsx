import { getAuditPage } from "@/lib/audit";
import Pager, { parsePage } from "@/app/admin/pager";
import { kstDateTime, isoInstant } from "@/lib/kst";

export const metadata = { title: "기록 · 관리자" };

// targetType별 배지 색.
const BADGE: Record<string, string> = {
  feed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  member:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  report: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  series:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  site: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  admin: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePage((await searchParams).page);
  const { items, total, pageSize } = await getAuditPage(page);

  return (
    <section>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">
        관리 기록 ({total})
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        관리자 거버넌스 액션(글·회원·신고·시리즈·점검모드) 기록입니다.
      </p>
      {items.length === 0 ? (
        <p className="text-zinc-500">아직 기록이 없습니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-3 text-sm">
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                  BADGE[a.targetType] ?? BADGE.admin
                }`}
              >
                {a.targetType}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{a.summary}</span>
                <time
                  dateTime={isoInstant(a.createdAt)}
                  className="text-xs text-zinc-400"
                >
                  {kstDateTime(a.createdAt)}
                </time>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        total={total}
        pageSize={pageSize}
        basePath="/admin/audit"
      />
    </section>
  );
}
