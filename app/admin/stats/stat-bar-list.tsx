import type { TrendPoint } from "@/lib/stats";

// 일별 추이를 가로 막대 목록으로. 라벨(MM-DD)·수치는 실제 텍스트(접근 가능),
// 막대는 장식(aria-hidden). 차트 라이브러리 없이 CSS만.
export default function StatBarList({ data }: { data: TrendPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="flex flex-col gap-1">
      {data.map((d) => (
        <li key={d.day} className="flex items-center gap-2 text-xs">
          <span className="w-12 shrink-0 text-zinc-500 tabular-nums">
            {d.day.slice(5)}
          </span>
          <span className="flex-1">
            <span
              aria-hidden
              className="bg-foreground/70 block h-3 rounded"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </span>
          <span className="w-10 shrink-0 text-right tabular-nums">
            {d.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
