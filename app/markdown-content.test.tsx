import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import MarkdownContent from "@/app/markdown-content";

describe("MarkdownContent", () => {
  test("제목·강조·링크·목록을 올바른 HTML로 렌더", () => {
    render(
      <MarkdownContent
        content={
          "# 큰제목\n\n**굵게** 그리고 [링크](https://example.com)\n\n- 첫\n- 둘"
        }
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "큰제목" }),
    ).toBeInTheDocument();
    expect(screen.getByText("굵게").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "링크" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  test("raw HTML은 이스케이프되어 실행 요소로 들어가지 않음(XSS 안전)", () => {
    const { container } = render(
      <MarkdownContent content={"<script>alert(1)</script> 안녕"} />,
    );
    expect(container.querySelector("script")).toBeNull();
  });

  test("펜스 코드블록을 hljs로 하이라이트(토큰 span 생성)", () => {
    const { container } = render(
      <MarkdownContent content={"```js\nconst x = 1;\n```"} />,
    );
    const code = container.querySelector("pre code.hljs");
    expect(code).not.toBeNull();
    // highlight.js가 키워드 등 토큰을 span으로 감쌈.
    expect(container.querySelector("pre code .hljs-keyword")).not.toBeNull();
  });

  test("본문 이미지: ?w&h를 width/height로 부여 + loading=lazy(CLS 방지)", () => {
    const { container } = render(
      <MarkdownContent content={"![설명](/uploads/a.jpg?w=800&h=600)"} />,
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBe("800");
    expect(img.getAttribute("height")).toBe("600");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("alt")).toBe("설명");
  });

  test("쿼리 없는(외부) 이미지: width 없이 lazy만", () => {
    const { container } = render(
      <MarkdownContent content={"![](https://example.com/x.jpg)"} />,
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBeNull();
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  test("번호 목록은 ol, 글머리 목록은 ul로 구분 렌더", () => {
    const { container } = render(
      <MarkdownContent content={"1. 하나\n2. 둘\n\n- 점"} />,
    );
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
    expect(container.querySelectorAll("ul > li")).toHaveLength(1);
  });

  test("코드블록: 언어 라벨 + 복사 버튼(하이라이트 전 원문 복사) + 키보드 포커스 가능한 pre", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { container } = render(
      <MarkdownContent content={"```ts\nconst x = 1;\n```"} />,
    );
    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(container.querySelector("pre")).toHaveAttribute("tabindex", "0");
    fireEvent.click(screen.getByRole("button", { name: "코드 복사" }));
    expect(writeText).toHaveBeenCalledWith("const x = 1;");
  });

  test("h2·h3 옆 섹션 링크(#) — 헤딩 이름은 그대로, h1엔 없음", () => {
    render(<MarkdownContent content={"# 큰\n\n## 소개\n\n### 세부 항목"} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "소개" }),
    ).toHaveAttribute("id", "소개");
    expect(
      screen.getByRole("link", { name: "소개 섹션 링크" }),
    ).toHaveAttribute("href", "#소개");
    expect(
      screen.getByRole("link", { name: "세부 항목 섹션 링크" }),
    ).toHaveAttribute("href", "#세부-항목");
    expect(screen.queryByRole("link", { name: "큰 섹션 링크" })).toBeNull();
  });

  test("콜아웃 `> [!WARNING]` → role=note + 한국어 제목, 일반 인용문은 blockquote 유지", () => {
    const { container } = render(
      <MarkdownContent
        content={"> [!WARNING]\n> 되돌릴 수 없어요\n\n> 그냥 인용"}
      />,
    );
    const note = screen.getByRole("note");
    expect(note).toHaveAttribute("data-callout", "warning");
    expect(within(note).getByText("주의")).toBeInTheDocument();
    expect(within(note).getByText("되돌릴 수 없어요")).toBeInTheDocument();
    expect(note).not.toHaveTextContent("[!WARNING]");
    expect(container.querySelector("blockquote")).toHaveTextContent(
      "그냥 인용",
    );
  });

  test("각주: 한국어 라벨·되돌아가기 이름, 각주 제목엔 섹션 링크 없음", () => {
    const { container } = render(
      <MarkdownContent content={"본문[^1]\n\n[^1]: 각주 내용"} />,
    );
    const section = container.querySelector("[data-footnotes]")!;
    expect(
      within(section as HTMLElement).getByRole("heading", { name: "각주" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "1번 각주 참조 위치로 돌아가기" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "각주 섹션 링크" })).toBeNull();
  });

  test("캡션 있는 단독 이미지 → figure/figcaption + 확대 버튼, 캡션은 alt와 분리", () => {
    const { container } = render(
      <MarkdownContent
        content={'![책상 사진](/uploads/d.jpg?w=4&h=3 "작업 공간")'}
      />,
    );
    const fig = container.querySelector("figure")!;
    expect(fig.querySelector("figcaption")).toHaveTextContent("작업 공간");
    const btn = within(fig).getByRole("button", {
      name: "이미지 크게 보기: 책상 사진",
    });
    expect(btn.querySelector("img")).not.toHaveAttribute("title");
    expect(container.querySelector("p figure, p dialog")).toBeNull();
  });

  test("링크 안 이미지는 확대 버튼 없이 링크로만(a 안 button 중첩 금지)", () => {
    const { container } = render(
      <MarkdownContent content={"[![배지](/b.png)](https://example.com)"} />,
    );
    expect(screen.queryByRole("button", { name: /크게 보기/ })).toBeNull();
    expect(container.querySelector("a img")).toHaveAttribute("alt", "배지");
    expect(container.querySelector("a button")).toBeNull();
  });

  test("단독 YouTube 링크 → 재생 버튼 파사드(iframe 미로드), 문장 속 링크는 그대로", () => {
    const { container } = render(
      <MarkdownContent
        content={
          "[소개 영상](https://youtu.be/dQw4w9WgXcQ)\n\n참고: https://youtu.be/dQw4w9WgXcQ 링크"
        }
      />,
    );
    expect(
      screen.getByRole("button", { name: "동영상 재생: 소개 영상" }),
    ).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("p div, p button")).toBeNull();
    // 문장 속 링크는 임베드 없이 링크로 남음
    expect(
      screen.getAllByRole("link", { name: "https://youtu.be/dQw4w9WgXcQ" }),
    ).toHaveLength(1);
  });

  test("콜아웃 div는 임베드 분기와 무관하게 그대로 렌더", () => {
    render(<MarkdownContent content={"> [!NOTE]\n> 내용"} />);
    expect(screen.getByRole("note")).toHaveTextContent("참고");
  });

  test("수식: 인라인 $$…$$·블록 $$ 줄·```math를 KaTeX(+스크린리더용 MathML)로, 코드 바 없이", () => {
    const { container } = render(
      <MarkdownContent
        content={
          "넓이는 $$\\pi r^2$$ 입니다.\n\n$$\nE = mc^2\n$$\n\n```math\n\\sum_{i=1}^{n} i\n```"
        }
      />,
    );
    expect(container.querySelectorAll(".katex").length).toBe(3);
    expect(container.querySelectorAll(".katex-display").length).toBe(2);
    expect(container.querySelector("math annotation")).toHaveTextContent(
      "\\pi r^2",
    );
    expect(screen.queryByRole("button", { name: "코드 복사" })).toBeNull();
  });

  test("한 개짜리 $는 수식이 아님(금액 표기 보호)", () => {
    const { container } = render(
      <MarkdownContent content={"가격은 $5이고 할인가는 $3입니다."} />,
    );
    expect(container.querySelector(".katex")).toBeNull();
    expect(container).toHaveTextContent("가격은 $5이고 할인가는 $3입니다.");
  });

  test("링크·HTML 생성 명령(\\href)은 실행되지 않고, 문법 오류는 빨간 원문으로", () => {
    const { container } = render(
      <MarkdownContent
        content={"$$\\href{javascript:alert(1)}{x}$$ 그리고 $$\\frac{1}{$$"}
      />,
    );
    expect(container.querySelector("a[href^='javascript']")).toBeNull();
    expect(container.querySelectorAll(".katex-error").length).toBeGreaterThan(
      0,
    );
  });

  test("```mermaid는 코드 바 대신 다이어그램 컴포넌트(초기엔 원문 표시, 하이라이트 없음)", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const { container } = render(
      <MarkdownContent content={"```mermaid\ngraph TD; A-->B\n```"} />,
    );
    expect(container.querySelector("figure pre code")).toHaveTextContent(
      "graph TD; A-->B",
    );
    expect(screen.queryByRole("button", { name: "코드 복사" })).toBeNull();
    expect(container.querySelector(".hljs")).toBeNull();
    vi.unstubAllGlobals();
  });

  test("작업 목록 체크박스는 완료 여부를 이름으로 가짐", () => {
    render(<MarkdownContent content={"- [x] 끝난 일\n- [ ] 남은 일"} />);
    expect(screen.getByRole("checkbox", { name: "완료한 항목" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "미완료 항목" }),
    ).not.toBeChecked();
  });

  test("단독 이미지는 figure(블록), 문장 속·링크 속 이미지는 문단(p) 안에 남음", () => {
    const { container } = render(
      <MarkdownContent
        content={
          "![단독](/a.png?w=8&h=5)\n\n문장 속 ![배지](/b.png?w=3&h=1) 끝\n\n[![링크 배지](/c.png)](https://x.dev) 끝"
        }
      />,
    );
    expect(container.querySelector("figure img")).toHaveAttribute(
      "alt",
      "단독",
    );
    expect(container.querySelector("figure figcaption")).toBeNull();
    expect(container.querySelector("p img[alt='배지']")).not.toBeNull();
    expect(container.querySelector("p a img[alt='링크 배지']")).not.toBeNull();
  });
});
