import Link from "next/link";
import { listSeries } from "@/lib/series";
import SeriesForm from "./series-form";
import { createSeriesAction } from "./actions";

export const metadata = { title: "시리즈 · 관리자" };

export default async function AdminSeriesPage() {
  const series = await listSeries();

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold tracking-tight">
          시리즈 ({series.length})
        </h1>
        {series.length === 0 ? (
          <p className="text-zinc-500">아직 시리즈가 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
            {series.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="truncate text-sm text-zinc-500">
                    /series/{s.slug} · 글 {s._count.feeds}개
                  </p>
                </div>
                <Link
                  href={`/admin/series/${s.id}`}
                  className="shrink-0 rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20"
                >
                  편집
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">새 시리즈</h2>
        <SeriesForm action={createSeriesAction} submitLabel="만들기" />
      </div>
    </section>
  );
}
