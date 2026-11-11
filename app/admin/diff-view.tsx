import type { DiffRow } from "@/lib/text-diff";

// 줄 단위 비교 결과 표시. 추가·삭제는 의미 요소(<ins>/<del>) + 보조기술용 "추가/삭제" 라벨 +
// 색에 의존하지 않는 +/− 기호. 접힌 동일 구간은 줄 수만.
export default function DiffView({ rows }: { rows: DiffRow[] }) {
  if (rows.length === 1 && rows[0].type === "skip") {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">본문 변경 없음</p>
    );
  }
  return (
    <ol className="overflow-x-auto rounded border border-black/[.08] font-mono text-xs leading-6 dark:border-white/[.145]">
      {rows.map((r, i) =>
        r.type === "skip" ? (
          <li
            key={i}
            className="bg-black/[.03] px-3 text-zinc-500 dark:bg-white/[.04] dark:text-zinc-400"
          >
            … 동일한 {r.count}줄 생략
          </li>
        ) : r.type === "add" ? (
          <li
            key={i}
            className="bg-green-100 px-3 text-green-900 dark:bg-green-900/40 dark:text-green-200"
          >
            <ins className="whitespace-pre-wrap no-underline">
              <span aria-hidden="true">+ </span>
              <span className="sr-only">추가: </span>
              {r.text}
            </ins>
          </li>
        ) : r.type === "del" ? (
          <li
            key={i}
            className="bg-red-100 px-3 text-red-900 dark:bg-red-900/40 dark:text-red-200"
          >
            <del className="whitespace-pre-wrap">
              <span aria-hidden="true">− </span>
              <span className="sr-only">삭제: </span>
              {r.text}
            </del>
          </li>
        ) : (
          <li key={i} className="px-3 whitespace-pre-wrap">
            <span aria-hidden="true">{"  "}</span>
            {r.text}
          </li>
        ),
      )}
    </ol>
  );
}
