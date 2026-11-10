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
});
