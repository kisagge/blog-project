import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/dal", () => ({ getViewerRole: vi.fn(async () => "anon") }));
vi.mock("@/lib/feeds", () => ({ getArchiveFeeds: vi.fn() }));

import ArchivePage from "@/app/archive/page";
import { getArchiveFeeds } from "@/lib/feeds";

const feeds = vi.mocked(getArchiveFeeds);

describe("ArchivePage", () => {
  test("연(h2)→월(h3) 위계로 글을 묶고 날짜는 time, 제목은 상세 링크", async () => {
    feeds.mockResolvedValue([
      {
        slug: "b",
        title: "11월 글",
        createdAt: new Date("2026-11-05T00:00:00Z"),
      },
      {
        slug: "a",
        title: "작년 글",
        createdAt: new Date("2025-03-01T00:00:00Z"),
      },
    ]);
    render(await ArchivePage());

    expect(screen.getByRole("heading", { level: 1, name: "아카이브" }));
    expect(screen.getByText("글 2개")).toBeInTheDocument();
    const y2026 = screen.getByRole("region", { name: "2026년 1개" });
    expect(
      within(y2026).getByRole("heading", { level: 3, name: "11월" }),
    ).toBeInTheDocument();
    expect(
      within(y2026).getByRole("link", { name: "11월 글" }),
    ).toHaveAttribute("href", "/feed/b");
    expect(within(y2026).getByText("5일").tagName).toBe("TIME");
    expect(
      screen.getByRole("region", { name: "2025년 1개" }),
    ).toBeInTheDocument();
  });

  test("글이 없으면 안내 문구", async () => {
    feeds.mockResolvedValue([]);
    render(await ArchivePage());
    expect(screen.getByText("아직 글이 없습니다.")).toBeInTheDocument();
  });
});
