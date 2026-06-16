// 회원 글쓰기용 마크다운 문법 도움말. 네이티브 <details>로 키보드·스크린리더 기본 지원.
const ROWS: { syntax: string; desc: string }[] = [
  { syntax: "# 제목  ## 소제목  ### 작은제목", desc: "제목(목차에 반영)" },
  { syntax: "**굵게**", desc: "굵은 글씨" },
  { syntax: "*기울임*", desc: "기울인 글씨" },
  { syntax: "[글자](https://주소)", desc: "링크" },
  { syntax: "![설명](https://이미지주소)", desc: "이미지(외부 URL)" },
  { syntax: "- 항목", desc: "목록(줄마다 -)" },
  { syntax: "1. 항목", desc: "번호 목록" },
  { syntax: "> 인용", desc: "인용구" },
  { syntax: "`코드`", desc: "인라인 코드" },
  { syntax: "| a | b |", desc: "표(머리글 아래 | --- | --- | 줄 추가)" },
  { syntax: "---", desc: "구분선" },
];

export default function MarkdownHelp() {
  return (
    <details className="rounded-lg border border-black/[.06] bg-black/[.02] p-3 dark:border-white/[.1] dark:bg-white/[.03]">
      <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-300">
        마크다운 작성 도움말
      </summary>
      <p className="mt-2 text-xs text-zinc-500">
        본문은 마크다운으로 작성합니다. 자주 쓰는 문법은 아래와 같아요. 이미지는
        외부 URL만 넣을 수 있고 파일 업로드는 지원하지 않습니다.
      </p>
      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-400">
            <th className="py-1 pr-3 font-medium">입력</th>
            <th className="py-1 font-medium">결과</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr
              key={r.syntax}
              className="border-t border-black/[.06] dark:border-white/[.08]"
            >
              <td className="py-1 pr-3 align-top">
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                  {r.syntax}
                </code>
              </td>
              <td className="py-1 align-top text-zinc-600 dark:text-zinc-300">
                {r.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
