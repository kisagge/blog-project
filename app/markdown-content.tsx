import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

// 게시 글 본문과 작성 미리보기가 공유하는 마크다운 렌더러.
// react-markdown은 기본적으로 raw HTML을 렌더하지 않아(별도 rehype-raw 없음) XSS에 안전.
// 훅이 없어 "use client" 불필요 — 서버(글 상세)·클라이언트(에디터 미리보기) 양쪽에서 사용.
export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-4 leading-7 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 dark:[&_code]:bg-zinc-800 [&_h1]:scroll-mt-24 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded [&_li]:ml-5 [&_li]:list-disc [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
