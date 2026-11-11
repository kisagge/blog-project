"use client";

import { useEffect, useId, useRef, useState } from "react";

type State =
  { kind: "idle" } | { kind: "ready"; svg: string } | { kind: "error" };

// 현재 사이트 테마(data-theme) → Mermaid 테마. 대표(brand)도 어두운 배경이라 dark.
function mermaidTheme(): "dark" | "default" {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "dark" || t === "brand" ? "dark" : "default";
}

// ```mermaid 코드블록을 다이어그램(SVG)으로. Mermaid는 무거워(수백 KB) 화면 근처에 올 때만
// 동적 import → 다이어그램 없는 글·화면 밖 다이어그램은 로드 비용 0. 회원 글에도 쓰일 수 있어 이중 방어:
// securityLevel "strict"(클릭 콜백 차단) + 라벨을 SVG 텍스트로(htmlLabels:false) + 완성된 SVG를 DOMPurify로
// 다시 정화(스크립트·이벤트 핸들러·위험 URL·foreignObject 제거)한 뒤 삽입. 테마 토글 시 다시 그림. 그리기 전·실패 시엔 원문 코드를 보여 준다.
export default function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [visible, setVisible] = useState(false);
  const [theme, setTheme] = useState<"dark" | "default" | null>(null);
  const renderId = `mmd-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // 화면 근처 진입 감지(1회).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 테마 추적(헤더 토글이 <html data-theme>를 바꿈).
  useEffect(() => {
    const sync = () => setTheme(mermaidTheme());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !theme) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ default: mermaid }, { default: DOMPurify }] =
          await Promise.all([import("mermaid"), import("dompurify")]);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme,
          // 라벨을 HTML(foreignObject) 대신 SVG 텍스트로 → 정화 후에도 라벨 유지 + HTML 주입 표면 제거.
          htmlLabels: false,
          flowchart: { htmlLabels: false },
        });
        const { svg } = await mermaid.render(renderId, code);
        const clean = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true, html: true }, // html: SVG 내 <style> 유지
          FORBID_TAGS: ["foreignObject"], // 라벨은 SVG 텍스트만 — HTML 섬 금지
        });
        if (!cancelled) setState({ kind: "ready", svg: clean });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, theme, code, renderId]);

  return (
    <figure ref={ref} className="flex flex-col gap-2">
      {state.kind === "ready" ? (
        <div
          className="flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
          // Mermaid strict 렌더 결과를 DOMPurify로 한 번 더 정화한 SVG.
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ) : (
        <pre className="overflow-x-auto rounded bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
          <code>{code}</code>
        </pre>
      )}
      {state.kind === "error" && (
        <figcaption
          role="note"
          className="text-xs text-red-700 dark:text-red-400"
        >
          다이어그램을 그리지 못해 원문을 표시합니다. 문법을 확인해 주세요.
        </figcaption>
      )}
      {state.kind === "ready" && (
        <details className="text-xs text-zinc-600 dark:text-zinc-400">
          <summary>다이어그램 원문 보기</summary>
          <pre className="mt-1 overflow-x-auto rounded bg-zinc-100 p-3 dark:bg-zinc-900">
            <code>{code}</code>
          </pre>
        </details>
      )}
    </figure>
  );
}
