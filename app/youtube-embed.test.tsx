import { describe, expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import YouTubeEmbed from "@/app/youtube-embed";

const HREF = "https://youtu.be/dQw4w9WgXcQ";

describe("YouTubeEmbed", () => {
  test("처음엔 iframe 없이 썸네일(장식 alt) + 제목 기반 재생 버튼 + 대체 링크", () => {
    const { container } = render(
      <YouTubeEmbed id="dQw4w9WgXcQ" title="데모" href={HREF} />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    const btn = screen.getByRole("button", { name: "동영상 재생: 데모" });
    expect(btn.querySelector("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
    expect(btn.querySelector("img")).toHaveAttribute("alt", "");
    const link = screen.getByRole("link", { name: "YouTube에서 보기: 데모" });
    expect(link).toHaveAttribute("href", HREF);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("재생 클릭 → nocookie iframe(autoplay·start, 제목) 로드 + 포커스 이동", () => {
    const { container } = render(
      <YouTubeEmbed id="dQw4w9WgXcQ" start={90} href={HREF} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "동영상 재생: YouTube 동영상" }),
    );
    const frame = container.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&start=90",
    );
    expect(frame).toHaveAttribute("title", "YouTube 동영상");
    expect(frame).toHaveAttribute("allowfullscreen");
    expect(document.activeElement).toBe(frame);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
