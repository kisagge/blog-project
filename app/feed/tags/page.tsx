import Link from "next/link";
import { getTagsWithCounts } from "@/lib/tags";
import { getViewerRole } from "@/lib/dal";

export const metadata = {
  title: "태그",
  description: "글을 주제별로 모아보기",
  alternates: { canonical: "/feed/tags" },
};

// 런타임 DB 조회.
export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await getTagsWithCounts(await getViewerRole());

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">태그</h1>
      {tags.length === 0 ? (
        <p className="text-zinc-500">아직 태그가 없습니다.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/feed/tags/${encodeURIComponent(t.slug)}`}
                className="inline-flex items-center gap-1.5 rounded bg-amber-100 px-2 py-1 text-sm font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
              >
                #{t.name}
                <span className="text-xs text-amber-600/80 dark:text-amber-400/80">
                  {t.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
