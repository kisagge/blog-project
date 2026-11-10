import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import CodeCopyButton from "@/app/code-copy-button";

const writeText = vi.fn();
const origClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  setClipboard({ writeText });
});

afterEach(() => {
  vi.useRealTimers();
  if (origClipboard)
    Object.defineProperty(navigator, "clipboard", origClipboard);
});

describe("CodeCopyButton", () => {
  test("접근 가능한 이름은 '코드 복사'(보이는 문구 '복사' 포함)", () => {
    render(<CodeCopyButton code="x" />);
    expect(screen.getByRole("button", { name: "코드 복사" })).toHaveTextContent(
      "복사",
    );
  });

  test("클릭 → 원문을 클립보드에 기록 + 버튼·status로 완료 안내", async () => {
    render(<CodeCopyButton code={"const x = 1;"} />);
    fireEvent.click(screen.getByRole("button", { name: "코드 복사" }));
    expect(writeText).toHaveBeenCalledWith("const x = 1;");
    expect(await screen.findByRole("button", { name: "코드 복사됨" }));
    expect(screen.getByRole("status")).toHaveTextContent("코드를 복사했습니다");
  });

  test("1.5초 뒤 원래 문구로 복귀", async () => {
    vi.useFakeTimers();
    render(<CodeCopyButton code="x" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "코드 복사" }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("코드를 복사했습니다");
    act(() => vi.advanceTimersByTime(1500));
    expect(
      screen.getByRole("button", { name: "코드 복사" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  test("클립보드 거부 → 실패 안내", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<CodeCopyButton code="x" />);
    fireEvent.click(screen.getByRole("button", { name: "코드 복사" }));
    expect(await screen.findByText("복사하지 못했습니다")).toBeInTheDocument();
  });

  test("Clipboard API 없음(비보안 컨텍스트) → 실패 안내", () => {
    setClipboard(undefined);
    render(<CodeCopyButton code="x" />);
    fireEvent.click(screen.getByRole("button", { name: "코드 복사" }));
    expect(screen.getByRole("status")).toHaveTextContent("복사하지 못했습니다");
  });
});
