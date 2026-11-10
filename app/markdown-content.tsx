import type { ComponentPropsWithoutRef } from "react";
import type { Element } from "hast";
import ReactMarkdown, { type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import CodeCopyButton from "@/app/code-copy-button";
import ZoomableImage from "@/app/zoomable-image";
import YouTubeEmbed from "@/app/youtube-embed";
import {
  hastText,
  rehypeCallouts,
  rehypeEmbeds,
  rehypeFigures,
  rehypeMarkLinkedImages,
} from "@/lib/markdown-plugins";

// 본문 이미지: 업로드 URL의 ?w&h를 width/height로 부여해 로드 전 공간을 예약(CLS 방지) +
// loading="lazy"로 지연 로드. 쿼리 없는(외부) 이미지는 lazy만 적용.
// 클릭 확대(ZoomableImage)를 씌우되, 링크 안 이미지(rehypeMarkLinkedImages)는 a 안 button 중첩을
// 피하려 평범한 img로 둔다(클릭은 링크 이동).
function MdImg({
  src,
  alt,
  title,
  node,
}: {
  src?: string | Blob;
  alt?: string;
  title?: string;
  node?: Element;
}) {
  const url = typeof src === "string" ? src : undefined;
  let width: number | undefined;
  let height: number | undefined;
  if (url) {
    try {
      const q = new URL(url, "http://x").searchParams;
      const w = Number(q.get("w"));
      const h = Number(q.get("h"));
      if (w > 0 && h > 0) {
        width = w;
        height = h;
      }
    } catch {
      /* 잘못된 URL — 속성 없이 렌더 */
    }
  }
  if (url && !node?.properties.dataLinked) {
    return (
      <ZoomableImage
        src={url}
        alt={alt ?? ""}
        title={title}
        width={width}
        height={height}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt ?? ""}
      title={title}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
    />
  );
}

type WithNode<T extends keyof React.JSX.IntrinsicElements> =
  ComponentPropsWithoutRef<T> & { node?: Element };

// 펜스 코드블록: 상단 바(언어 라벨 + 복사 버튼) + 가로 스크롤 pre.
// 복사 원문은 하이라이트 span을 걷어낸 hast 텍스트(끝 개행 1개 제거). 스크롤 영역이라 키보드 포커스 가능.
function MdPre({ node, children }: WithNode<"pre">) {
  const code = node?.children.find(
    (c): c is Element => c.type === "element" && c.tagName === "code",
  );
  const classes = code?.properties.className;
  const lang = Array.isArray(classes)
    ? classes
        .map(String)
        .find((c) => c.startsWith("language-"))
        ?.slice("language-".length)
    : undefined;
  return (
    <div className="overflow-hidden rounded bg-zinc-100 text-sm dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-black/[.06] px-4 py-1 text-xs text-zinc-600 dark:border-white/[.1] dark:text-zinc-400">
        <span>{lang}</span>
        <CodeCopyButton code={code ? hastText(code).replace(/\n$/, "") : ""} />
      </div>
      <pre tabIndex={0} className="overflow-x-auto p-4">
        {children}
      </pre>
    </div>
  );
}

// 본문 h2·h3(목차 대상) 옆에 섹션 딥링크(#). 링크를 헤딩 밖에 둬 헤딩의 접근 가능한 이름을 오염시키지 않음.
// 호버·포커스 시 노출, 호버 없는 터치 기기에선 항상 노출. GFM 각주의 sr-only 제목은 앵커 제외.
function anchored(Tag: "h2" | "h3") {
  return function MdHeading({ node, id, children, ...rest }: WithNode<"h2">) {
    const heading = (
      <Tag id={id} {...rest}>
        {children}
      </Tag>
    );
    if (!id || rest.className?.includes("sr-only")) return heading;
    return (
      <div className="group flex items-baseline gap-2">
        {heading}
        <a
          href={`#${id}`}
          aria-label={`${node ? hastText(node) : id} 섹션 링크`}
          className="text-zinc-500 no-underline! opacity-0 group-hover:opacity-100 focus-visible:opacity-100 dark:text-zinc-400 [@media(hover:none)]:opacity-100"
        >
          #
        </a>
      </div>
    );
  };
}

// rehypeEmbeds가 표시한 단독 YouTube 링크 → 파사드 플레이어. 그 외 div(콜아웃 등)는 그대로.
function MdDiv({ node, children, ...rest }: WithNode<"div">) {
  const p = node?.properties;
  if (p?.dataEmbed === "youtube" && typeof p.dataVideoId === "string") {
    const a = node?.children.find(
      (c): c is Element => c.type === "element" && c.tagName === "a",
    );
    return (
      <YouTubeEmbed
        id={p.dataVideoId}
        start={typeof p.dataStart === "number" ? p.dataStart : undefined}
        title={typeof p.dataTitle === "string" ? p.dataTitle : undefined}
        href={String(a?.properties.href ?? "")}
      />
    );
  }
  return <div {...rest}>{children}</div>;
}

const components: Options["components"] = {
  div: MdDiv,
  img: MdImg,
  pre: MdPre,
  h2: anchored("h2"),
  h3: anchored("h3"),
};

// GFM 각주 라벨 한국어화(기본 "Footnotes"/"Back to reference 1").
const remarkRehypeOptions: Options["remarkRehypeOptions"] = {
  footnoteLabel: "각주",
  footnoteBackLabel: (i, r) =>
    `${i + 1}${r > 1 ? `-${r}` : ""}번 각주 참조 위치로 돌아가기`,
};

// 게시 글 본문과 작성 미리보기가 공유하는 마크다운 렌더러.
// react-markdown은 기본적으로 raw HTML을 렌더하지 않아(별도 rehype-raw 없음) XSS에 안전.
// 서버(글 상세)·클라이언트(에디터 미리보기) 양쪽에서 사용 — 복사 버튼만 클라이언트 섬.
// 코드블록은 rehype-highlight(highlight.js)로 하이라이트(글 상세는 서버 렌더).
// 토큰 색은 globals.css의 .hljs-* 규칙(3테마 정합). 펜스 코드는 인라인 code 배경을 무력화.
// `> [!NOTE]` 등 콜아웃은 rehypeCallouts, 캡션 있는 단독 이미지는 rehypeFigures(figure/figcaption),
// 단독 YouTube 링크는 rehypeEmbeds → 클릭 시 로드하는 플레이어(YouTubeEmbed),
// 인용문·각주·콜아웃·캡션 스타일은 globals.css의 .md-content 규칙.
export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="md-content flex flex-col gap-4 leading-7 [&_.task-list-item]:list-none [&_a]:underline [&_button>img]:my-0 [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 dark:[&_code]:bg-zinc-800 [&_h1]:scroll-mt-24 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded [&_li]:ml-5 [&_ol]:list-decimal [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        remarkRehypeOptions={remarkRehypeOptions}
        rehypePlugins={[
          rehypeSlug,
          rehypeHighlight,
          rehypeCallouts,
          rehypeFigures,
          rehypeEmbeds,
          rehypeMarkLinkedImages,
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
