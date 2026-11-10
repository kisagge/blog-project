import type { Element, ElementContent, Root, RootContent } from "hast";
import { defaultUrlTransform } from "react-markdown";

// 노드의 텍스트만 이어붙임(하이라이트 span으로 쪼개진 코드 원문 복원·제목 텍스트 추출용).
export function hastText(node: Root | RootContent | ElementContent): string {
  if (node.type === "text") return node.value;
  if ("children" in node) return node.children.map(hastText).join("");
  return "";
}

// GitHub 문법 콜아웃(`> [!NOTE]`)의 종류 → 표시 제목.
const CALLOUTS: Record<string, string> = {
  note: "참고",
  tip: "팁",
  important: "중요",
  warning: "주의",
  caution: "경고",
};

const MARKER = /^\[!(\w+)\][ \t]*(?:\r?\n)?/;

// 인용문 첫 문단이 `[!NOTE]` 등으로 시작하면 콜아웃으로 변환.
// 인용이 아니라 보조 정보라 blockquote 대신 role="note" div. 표식은 본문에서 제거하고 제목 문단을 앞에 붙인다.
function toCallout(quote: Element): boolean {
  const first = quote.children.find((c): c is Element => c.type === "element");
  if (!first || first.tagName !== "p") return false;
  const head = first.children[0];
  if (head?.type !== "text") return false;
  const m = head.value.match(MARKER);
  const type = m?.[1].toLowerCase();
  if (!m || !type || !(type in CALLOUTS)) return false;

  head.value = head.value.slice(m[0].length);
  if (!head.value) first.children.shift();
  if (first.children.length === 0) {
    quote.children.splice(quote.children.indexOf(first), 1);
  }

  quote.tagName = "div";
  quote.properties = {
    ...quote.properties,
    role: "note",
    className: ["md-callout"],
    dataCallout: type,
  };
  quote.children.unshift({
    type: "element",
    tagName: "p",
    properties: { className: ["md-callout-title"] },
    children: [{ type: "text", value: CALLOUTS[type] }],
  });
  return true;
}

function walk(node: Root | Element, visit: (el: Element) => void) {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    visit(child);
    walk(child, visit);
  }
}

export function rehypeCallouts() {
  return (tree: Root) =>
    walk(tree, (el) => {
      if (el.tagName === "blockquote") toCallout(el);
    });
}

const isBlank = (c: ElementContent) => c.type === "text" && !c.value.trim();

// 제목(title)이 있는 단독 이미지 문단(`![alt](src "캡션")`)을 figure + figcaption으로.
// alt(대체 텍스트)와 캡션을 분리해 스크린리더가 같은 문장을 두 번 읽지 않게 하고,
// 캡션으로 옮긴 title은 img에서 제거(툴팁 중복 방지). p 안엔 figure를 둘 수 없어 p 자체를 바꾼다.
export function rehypeFigures() {
  return (tree: Root) =>
    walk(tree, (el) => {
      if (el.tagName !== "p") return;
      const solid = el.children.filter((c) => !isBlank(c));
      const img = solid[0];
      if (solid.length !== 1 || img.type !== "element" || img.tagName !== "img")
        return;
      const caption = img.properties.title;
      if (typeof caption !== "string" || !caption.trim()) return;
      delete img.properties.title;
      el.tagName = "figure";
      el.children = [
        img,
        {
          type: "element",
          tagName: "figcaption",
          properties: {},
          children: [{ type: "text", value: caption.trim() }],
        },
      ];
    });
}

// 링크 안 이미지에 dataLinked 표시 — 화면 렌더러가 확대 버튼을 씌우지 않게(a 안 button 중첩 금지).
// 서버 컴포넌트에선 React context를 못 쓰므로 hast 단계에서 조상 정보를 남긴다.
export function rehypeMarkLinkedImages() {
  const mark = (node: Root | Element, inLink: boolean) => {
    for (const child of node.children) {
      if (child.type !== "element") continue;
      if (inLink && child.tagName === "img") child.properties.dataLinked = true;
      mark(child, inLink || child.tagName === "a");
    }
  };
  return (tree: Root) => mark(tree, false);
}

// 화면 렌더러(react-markdown)와 같은 URL 정책: defaultUrlTransform이 허용하지 않는 스킴
// (javascript:·data: 등)의 a href·img src는 속성째 제거. react-markdown을 거치지 않는 HTML(RSS 본문)용.
export function rehypeSafeUrls() {
  return (tree: Root) =>
    walk(tree, (el) => {
      const key =
        el.tagName === "a" ? "href" : el.tagName === "img" ? "src" : null;
      const v = key && el.properties[key];
      if (typeof v === "string" && defaultUrlTransform(v) === "")
        delete el.properties[key!];
    });
}

// 사이트 상대 경로(`/uploads/…`, `/feed/…`)의 img src·a href를 절대 URL로.
// RSS 본문처럼 사이트 밖(리더)에서 렌더되는 HTML용. 프로토콜 상대(`//`)·외부·앵커는 그대로.
export function rehypeAbsoluteUrls(origin: string) {
  const abs = (v: unknown) =>
    typeof v === "string" && v.startsWith("/") && !v.startsWith("//")
      ? origin + v
      : v;
  return (tree: Root) =>
    walk(tree, (el) => {
      if (el.tagName === "img")
        el.properties.src = abs(el.properties.src) as string;
      if (el.tagName === "a")
        el.properties.href = abs(el.properties.href) as string;
    });
}
