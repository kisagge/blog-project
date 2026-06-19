import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ShareBar from "@/app/share-bar";
import { xIntentUrl } from "@/lib/share";

const URL = "https://by-jang-blog.xyz/feed/hello";
const TITLE = "안녕 세계";

const writeText = vi.fn().mockResolvedValue(undefined);
const origClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const origShare = Object.getOwnPropertyDescriptor(navigator, "share");

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  // 기본은 기기 공유 미지원.
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  if (origClipboard)
    Object.defineProperty(navigator, "clipboard", origClipboard);
  if (origShare) Object.defineProperty(navigator, "share", origShare);
  else
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
});

describe("ShareBar", () => {
  test("X 공유 링크는 intent URL + 새 탭 안전 속성", () => {
    render(<ShareBar url={URL} title={TITLE} />);
    const x = screen.getByRole("link", { name: "X에 공유" });
    expect(x).toHaveAttribute("href", xIntentUrl(URL, TITLE));
    expect(x).toHaveAttribute("target", "_blank");
    expect(x).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("URL 복사 클릭 → 클립보드에 url 기록 + '복사됨' 표시", async () => {
    render(<ShareBar url={URL} title={TITLE} />);
    fireEvent.click(screen.getByRole("button", { name: "URL 복사" }));
    expect(writeText).toHaveBeenCalledWith(URL);
    expect(await screen.findByTitle("복사됨")).toBeInTheDocument();
  });

  test("kakaoKey 없으면 카카오 버튼 미노출, 있으면 노출", () => {
    const { rerender } = render(<ShareBar url={URL} title={TITLE} />);
    expect(
      screen.queryByRole("button", { name: "카카오톡으로 공유" }),
    ).toBeNull();
    rerender(<ShareBar url={URL} title={TITLE} kakaoKey="k" />);
    expect(
      screen.getByRole("button", { name: "카카오톡으로 공유" }),
    ).toBeInTheDocument();
  });

  test("navigator.share 지원 시 기기 공유 버튼 노출", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    render(<ShareBar url={URL} title={TITLE} />);
    expect(
      await screen.findByRole("button", { name: "기기 공유(인스타 등)" }),
    ).toBeInTheDocument();
  });

  test("navigator.share 미지원 시 기기 공유 버튼 미노출", () => {
    render(<ShareBar url={URL} title={TITLE} />);
    expect(
      screen.queryByRole("button", { name: "기기 공유(인스타 등)" }),
    ).toBeNull();
  });
});
