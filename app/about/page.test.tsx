import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/site-config", () => ({ getAbout: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import AboutPage, { generateMetadata } from "@/app/about/page";
import { getAbout } from "@/lib/site-config";

const about = vi.mocked(getAbout);

describe("AboutPage", () => {
  test("본문이 없으면 404", async () => {
    about.mockResolvedValue(null);
    await expect(AboutPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("h1 소개 + 수정 시각(time) + 마크다운 본문 + AboutPage JSON-LD", async () => {
    about.mockResolvedValue({
      content: "## 저는\n\n**개발자**입니다.",
      updatedAt: new Date("2026-11-10T00:00:00Z"),
    });
    const { container } = render(await AboutPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "소개" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "저는" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('time[datetime="2026-11-10T00:00:00.000Z"]'),
    ).not.toBeNull();
    const ld = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(ld!.innerHTML)["@type"]).toBe("AboutPage");
  });

  test("메타 설명은 마크다운 기호를 뺀 평문 요약", async () => {
    about.mockResolvedValue({
      content: "## 저는\n\n**개발자**입니다.",
      updatedAt: null,
    });
    const meta = await generateMetadata();
    expect(meta.description).toBe("저는 개발자입니다.");
    expect(meta.alternates?.canonical).toBe("/about");
  });
});
