import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeedById } from "@/lib/feeds";
import { listRevisions, REVISION_LIMIT } from "@/lib/revisions";
import { isoInstant, kstDateTime } from "@/lib/kst";

export const metadata = { title: "수정 이력 · 관리자" };
export const dynamic = "force-dynamic";

// 관리자 글 수정 이력 목록(최신순). 관리자 레이아웃이 세션 가드.
export default async function RevisionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ restored?: string }>;
}) {
  const [{ id }, { restored }] = await Promise.all([params, searchParams]);
  const feed = await getFeedById(id);
  if (!feed) notFound();
  const revisions = await listRevisions(id);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">수정 이력</h1>
        <Link
          href={`/admin/${id}/edit`}
          className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
        >
          글 수정으로
        </Link>
      </div>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        ‘{feed.title}’ — 제목·요약·본문이 바뀐 저장 직전 버전을 최근{" "}
        {REVISION_LIMIT}개까지 보관합니다.
      </p>
      <p
        role="status"
        className="mb-4 text-sm text-green-700 dark:text-green-400"
      >
        {restored === "1"
          ? "이전 버전으로 되돌렸습니다. 되돌리기 직전 버전은 이력 맨 위에 있습니다."
          : restored === "0"
            ? "이미 같은 내용이라 바뀐 것이 없습니다."
            : ""}
      </p>
      {revisions.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          아직 수정 이력이 없습니다.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {revisions.map((r) => (
            <li key={r.id} className="py-2 text-sm">
              {/* 제목이 같은 이력이 여럿일 수 있어 시각·길이까지 링크 이름에 포함(링크 목록에서 구별). */}
              <Link
                href={`/admin/${id}/revisions/${r.id}`}
                className="group block min-w-0"
              >
                <span className="block truncate font-medium group-hover:underline">
                  {r.title}
                </span>{" "}
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  <time dateTime={isoInstant(r.createdAt)}>
                    {kstDateTime(r.createdAt)}
                  </time>{" "}
                  까지의 버전 · {r.length.toLocaleString()}자
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
