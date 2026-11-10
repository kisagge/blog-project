import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import {
  rehypeAbsoluteUrls,
  rehypeCallouts,
  rehypeFigures,
  rehypeSafeUrls,
} from "@/lib/markdown-plugins";

// RSS `content:encoded`용 본문 HTML. 화면 렌더러(MarkdownContent)와 같은 GFM·콜아웃 규칙을 쓰되,
// 리더는 사이트 CSS·JS가 없으므로 하이라이트·복사 버튼·앵커 없이 순수 HTML만 만든다.
// remark-rehype 기본값(allowDangerousHtml 없음)이라 raw HTML은 버려지고, 링크·이미지 URL은
// rehypeSafeUrls로 화면과 같은 스킴 정책(javascript:·data: 등 제거)을 적용 → XSS 안전.
export async function markdownToFeedHtml(
  markdown: string,
  origin: string,
): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { footnoteLabel: "각주" })
    .use(rehypeCallouts)
    .use(rehypeFigures)
    .use(rehypeSafeUrls)
    .use(rehypeAbsoluteUrls, origin)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}
