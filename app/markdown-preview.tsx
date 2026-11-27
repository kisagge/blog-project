"use client";
import dynamic from "next/dynamic";

// 편집기 미리보기용 마크다운 렌더러(지연 로드). MarkdownContent는 KaTeX·코드 하이라이트를 포함해
// 수백 KB라, 미리보기 탭을 열 때 처음 받도록 한다(작성만 하는 경우 내려받지 않음).
const MarkdownPreview = dynamic(() => import("@/app/markdown-content"), {
  ssr: false,
  loading: () => (
    <p role="status" className="text-sm text-zinc-500">
      미리보기를 불러오는 중…
    </p>
  ),
});

export default MarkdownPreview;
