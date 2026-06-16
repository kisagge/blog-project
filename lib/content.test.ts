import { describe, expect, test } from "vitest";
import { readingTimeMinutes, extractToc } from "@/lib/content";

describe("readingTimeMinutes", () => {
  test("빈/공백은 최소 1분", () => {
    expect(readingTimeMinutes("")).toBe(1);
    expect(readingTimeMinutes("   \n\n")).toBe(1);
  });

  test("500자=1분, 501자=2분(비공백 글자수 ÷ 500, 올림)", () => {
    expect(readingTimeMinutes("가".repeat(500))).toBe(1);
    expect(readingTimeMinutes("가".repeat(501))).toBe(2);
    expect(readingTimeMinutes("가".repeat(1000))).toBe(2);
  });

  test("마크다운 기호·코드블록은 카운트 제외", () => {
    // 코드블록 600자 + 본문 100자 → 본문만 카운트 → 1분
    const body = "내".repeat(100);
    const code = "```\n" + "x".repeat(600) + "\n```";
    expect(readingTimeMinutes(`${code}\n${body}`)).toBe(1);
    // 제목/강조/링크 기호 제외
    expect(readingTimeMinutes("## **굵게** [링크](http://x)")).toBe(1);
  });
});

describe("extractToc", () => {
  test("h2/h3 추출, 슬러그 생성", () => {
    const toc = extractToc("## 소개\n\n본문\n\n### 세부");
    expect(toc).toEqual([
      { depth: 2, text: "소개", slug: "소개" },
      { depth: 3, text: "세부", slug: "세부" },
    ]);
  });

  test("코드펜스 안의 #은 목차 제외", () => {
    const toc = extractToc("## 진짜\n```\n## 가짜\n```\n### 진짜2");
    expect(toc.map((t) => t.text)).toEqual(["진짜", "진짜2"]);
  });

  test("h1·h4는 제외(본문 h2~h3만)", () => {
    const toc = extractToc("# 제목\n## 둘\n#### 넷");
    expect(toc.map((t) => t.depth)).toEqual([2]);
  });

  test("중복 제목은 슬러그 dedup", () => {
    const toc = extractToc("## 같음\n## 같음");
    expect(toc.map((t) => t.slug)).toEqual(["같음", "같음-1"]);
  });

  test("인라인 마크다운은 text·slug에서 제거", () => {
    const toc = extractToc("## **굵게** `코드`");
    expect(toc[0].text).toBe("굵게 코드");
    expect(toc[0].slug).toBe("굵게-코드");
  });
});
