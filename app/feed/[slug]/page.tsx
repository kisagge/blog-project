import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getFeedBySlug } from "@/lib/feeds";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feed = await getFeedBySlug(slug);
  return { title: feed ? `${feed.title} · BY Playground` : "Not found · BY Playground" };
}

export default async function FeedDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feed = await getFeedBySlug(slug);
  if (!feed) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <article>
        <header className="mb-8 border-b border-black/[.06] pb-6 dark:border-white/[.1]">
          <h1 className="text-3xl font-semibold tracking-tight">{feed.title}</h1>
          <time dateTime={feed.createdAt.toISOString()} className="mt-2 block text-sm text-zinc-500">
            {feed.createdAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
          </time>
        </header>
        <div className="flex flex-col gap-4 leading-7 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded [&_li]:ml-5 [&_li]:list-disc [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 dark:[&_code]:bg-zinc-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{feed.content}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
