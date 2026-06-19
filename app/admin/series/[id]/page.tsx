import { notFound } from "next/navigation";
import { getSeriesById, listSeriesPostsAdmin } from "@/lib/series";
import SeriesForm from "../series-form";
import SeriesPostList from "../series-post-list";
import { updateSeriesAction, deleteSeriesAction } from "../actions";

export const metadata = { title: "시리즈 편집 · 관리자" };

export default async function EditSeriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [series, posts] = await Promise.all([
    getSeriesById(id),
    listSeriesPostsAdmin(id),
  ]);
  if (!series) notFound();

  const action = updateSeriesAction.bind(null, series.id);

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold tracking-tight">시리즈 편집</h1>

      <SeriesForm
        action={action}
        submitLabel="수정"
        defaultValues={{
          title: series.title,
          slug: series.slug,
          description: series.description,
        }}
      />

      <div>
        <h2 className="mb-1 text-lg font-semibold tracking-tight">
          글 순서 ({posts.length})
        </h2>
        <p className="mb-3 text-sm text-zinc-500">
          드래그로 순서를 바꿉니다. 글 추가는 각 글 수정 화면의 ‘시리즈’에서
          지정하세요.
        </p>
        <SeriesPostList initial={posts} />
      </div>

      <form action={deleteSeriesAction}>
        <input type="hidden" name="id" value={series.id} />
        <button
          type="submit"
          className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600"
        >
          시리즈 삭제
        </button>
        <span className="ml-2 text-xs text-zinc-500">
          (글은 삭제되지 않고 시리즈에서만 빠집니다)
        </span>
      </form>
    </section>
  );
}
