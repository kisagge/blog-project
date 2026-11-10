import { describe, expect, test } from "vitest";
import type { Element, Root } from "hast";
import {
  hastText,
  rehypeCallouts,
  rehypeFigures,
  rehypeMarkLinkedImages,
} from "@/lib/markdown-plugins";

const text = (value: string) => ({ type: "text" as const, value });
const el = (
  tagName: string,
  children: Element["children"] = [],
  properties: Element["properties"] = {},
): Element => ({ type: "element", tagName, properties, children });

// remark-rehype가 만드는 `> [!NOTE]\n> 내용` 형태(blockquote > p > text).
function quote(...paragraphs: Element["children"][]): Root {
  return {
    type: "root",
    children: [
      el("blockquote", [
        text("\n"),
        ...paragraphs.map((c) => el("p", c)),
        text("\n"),
      ]),
    ],
  };
}

function run(tree: Root) {
  rehypeCallouts()(tree);
  return tree.children[0] as Element;
}

describe("rehypeCallouts", () => {
  test("[!NOTE] 표식 → role=note 박스 + 한국어 제목, 표식은 본문에서 제거", () => {
    const box = run(quote([text("[!NOTE]\n알아두면 좋은 내용")]));
    expect(box.tagName).toBe("div");
    expect(box.properties).toMatchObject({
      role: "note",
      className: ["md-callout"],
      dataCallout: "note",
    });
    const [title, body] = box.children.filter(
      (c): c is Element => c.type === "element",
    );
    expect(hastText(title)).toBe("참고");
    expect(hastText(body)).toBe("알아두면 좋은 내용");
  });

  test.each([
    ["TIP", "tip", "팁"],
    ["IMPORTANT", "important", "중요"],
    ["WARNING", "warning", "주의"],
    ["CAUTION", "caution", "경고"],
    ["note", "note", "참고"], // 대소문자 무관
  ])("[!%s] → data-callout=%s, 제목 %s", (marker, type, label) => {
    const box = run(quote([text(`[!${marker}]\n내용`)]));
    expect(box.properties.dataCallout).toBe(type);
    expect(hastText(box.children[0])).toBe(label);
  });

  test("표식만 있는 첫 문단은 통째로 제거하고 다음 문단을 본문으로", () => {
    const box = run(quote([text("[!TIP]")], [text("다음 문단")]));
    const paras = box.children.filter(
      (c): c is Element => c.type === "element",
    );
    expect(paras).toHaveLength(2); // 제목 + 본문
    expect(hastText(paras[1])).toBe("다음 문단");
  });

  test("표식 뒤 인라인 요소(강조 등)는 보존", () => {
    const box = run(
      quote([text("[!WARNING]\n"), el("strong", [text("굵게")]), text(" 끝")]),
    );
    const body = box.children.filter(
      (c): c is Element => c.type === "element",
    )[1];
    expect(body.children[0]).toMatchObject({ tagName: "strong" });
    expect(hastText(body)).toBe("굵게 끝");
  });

  test("일반 인용문·미지원 표식은 그대로 blockquote", () => {
    expect(run(quote([text("그냥 인용")])).tagName).toBe("blockquote");
    expect(run(quote([text("[!FOO]\n내용")])).tagName).toBe("blockquote");
  });

  test("중첩 위치(목록 안)의 콜아웃도 변환", () => {
    const tree: Root = {
      type: "root",
      children: [
        el("ul", [
          el("li", [quote([text("[!NOTE]\n안쪽")]).children[0] as Element]),
        ]),
      ],
    };
    rehypeCallouts()(tree);
    const li = (tree.children[0] as Element).children[0] as Element;
    expect((li.children[0] as Element).properties.role).toBe("note");
  });
});

describe("hastText", () => {
  test("하이라이트 span으로 쪼개진 코드도 원문 텍스트로 합침", () => {
    const code = el("code", [
      el("span", [text("const")], { className: ["hljs-keyword"] }),
      text(" x = "),
      el("span", [text("1")], { className: ["hljs-number"] }),
      text(";\n"),
    ]);
    expect(hastText(code)).toBe("const x = 1;\n");
  });
});

describe("rehypeFigures", () => {
  const img = (props: Element["properties"]) => el("img", [], props);
  const root = (...children: Element[]): Root => ({ type: "root", children });

  test("제목(title)이 있는 단독 이미지 문단 → figure + figcaption, img의 title은 제거", () => {
    const tree = root(
      el("p", [img({ src: "/a.png", alt: "고양이", title: "우리 집 고양이" })]),
    );
    rehypeFigures()(tree);
    const fig = tree.children[0] as Element;
    expect(fig.tagName).toBe("figure");
    const [image, cap] = fig.children as Element[];
    expect(image.properties).toEqual({ src: "/a.png", alt: "고양이" });
    expect(cap.tagName).toBe("figcaption");
    expect(hastText(cap)).toBe("우리 집 고양이");
  });

  test("공백 텍스트만 곁에 있어도 단독 이미지로 취급", () => {
    const tree = root(
      el("p", [text("\n"), img({ src: "/a.png", title: "캡션" }), text(" ")]),
    );
    rehypeFigures()(tree);
    expect((tree.children[0] as Element).tagName).toBe("figure");
  });

  test("제목 없는 이미지·문장 속 이미지는 그대로 p(제목은 툴팁으로 유지)", () => {
    const plain = root(el("p", [img({ src: "/a.png", alt: "x" })]));
    rehypeFigures()(plain);
    expect((plain.children[0] as Element).tagName).toBe("p");

    const inline = root(
      el("p", [text("앞 "), img({ src: "/a.png", title: "툴팁" })]),
    );
    rehypeFigures()(inline);
    const p = inline.children[0] as Element;
    expect(p.tagName).toBe("p");
    expect((p.children[1] as Element).properties.title).toBe("툴팁");
  });
});

describe("rehypeMarkLinkedImages", () => {
  test("링크 안 이미지에만 dataLinked 표시(버튼 중첩 방지용)", () => {
    const linked = el("img", [], { src: "/in.png" });
    const free = el("img", [], { src: "/out.png" });
    const tree: Root = {
      type: "root",
      children: [
        el("p", [el("a", [el("span", [linked])], { href: "https://x" })]),
        el("p", [free]),
      ],
    };
    rehypeMarkLinkedImages()(tree);
    expect(linked.properties.dataLinked).toBe(true);
    expect(free.properties.dataLinked).toBeUndefined();
  });
});
