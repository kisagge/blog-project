import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

const renderMock = vi.fn();
const initializeMock = vi.fn();
vi.mock("mermaid", () => ({
  default: { initialize: initializeMock, render: renderMock },
}));

import MermaidDiagram from "@/app/mermaid-diagram";

// jsdom엔 IntersectionObserver가 없어 수동으로 "화면 진입"을 일으킨다.
let intersect: () => void = () => {};
beforeEach(() => {
  renderMock.mockReset();
  initializeMock.mockReset();
  document.documentElement.setAttribute("data-theme", "light");
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        intersect = () =>
          cb(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const CODE = "graph TD; A-->B";

describe("MermaidDiagram", () => {
  test("화면에 들어오기 전엔 Mermaid를 부르지 않고 원문 코드 표시", () => {
    render(<MermaidDiagram code={CODE} />);
    expect(screen.getByText(CODE)).toBeInTheDocument();
    expect(renderMock).not.toHaveBeenCalled();
  });

  test("진입 시 strict 보안으로 렌더 + 결과 SVG를 다시 정화(스크립트·이벤트 핸들러 제거)", async () => {
    renderMock.mockResolvedValue({
      svg: '<svg id="d" onload="alert(1)"><script>alert(2)</script><foreignObject><div onclick="x()">html</div></foreignObject><g><text>A</text></g></svg>',
    });
    const { container } = render(<MermaidDiagram code={CODE} />);
    act(() => intersect());
    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());
    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: "strict",
        theme: "default",
        htmlLabels: false,
      }),
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("onload")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("foreignObject, [onclick]")).toBeNull();
    expect(svg).toHaveTextContent("A");
    // 원문은 접이식으로 계속 제공
    expect(screen.getByText("다이어그램 원문 보기")).toBeInTheDocument();
  });

  test("어두운 테마(dark·brand)는 Mermaid dark 테마", async () => {
    document.documentElement.setAttribute("data-theme", "brand");
    renderMock.mockResolvedValue({ svg: "<svg></svg>" });
    render(<MermaidDiagram code={CODE} />);
    act(() => intersect());
    await waitFor(() =>
      expect(initializeMock).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "dark" }),
      ),
    );
  });

  test("문법 오류면 원문 코드 + 안내(role=note)", async () => {
    renderMock.mockRejectedValue(new Error("parse error"));
    render(<MermaidDiagram code={CODE} />);
    act(() => intersect());
    expect(await screen.findByRole("note")).toHaveTextContent(
      "다이어그램을 그리지 못해",
    );
    expect(screen.getByText(CODE)).toBeInTheDocument();
  });
});
