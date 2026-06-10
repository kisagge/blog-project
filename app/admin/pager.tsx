import Link from "next/link";

// 서버 렌더 페이지네이션: 이전/다음 + "현재/전체". basePath에 ?page= 를 붙인다.
export default function Pager({
  page,
  total,
  pageSize,
  basePath,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const current = Math.min(Math.max(1, page), totalPages);
  const href = (p: number) => (p <= 1 ? basePath : `${basePath}?page=${p}`);
  const linkCls =
    "rounded border border-black/15 px-3 py-1 hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.05]";
  const disabledCls =
    "rounded border border-black/[.06] px-3 py-1 text-zinc-300 dark:border-white/[.08] dark:text-zinc-600";

  return (
    <nav className="mt-6 flex items-center justify-center gap-3 text-sm">
      {current > 1 ? (
        <Link href={href(current - 1)} className={linkCls}>
          이전
        </Link>
      ) : (
        <span className={disabledCls}>이전</span>
      )}
      <span className="text-zinc-500">
        {current} / {totalPages}
      </span>
      {current < totalPages ? (
        <Link href={href(current + 1)} className={linkCls}>
          다음
        </Link>
      ) : (
        <span className={disabledCls}>다음</span>
      )}
    </nav>
  );
}

// searchParams의 page를 1 이상 정수로 파싱.
export function parsePage(value: string | string[] | undefined): number {
  const n = parseInt(
    String(Array.isArray(value) ? value[0] : (value ?? "1")),
    10,
  );
  return Number.isNaN(n) || n < 1 ? 1 : n;
}
