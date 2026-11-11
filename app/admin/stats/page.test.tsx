import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/stats", () => ({
  getStatsSummary: vi.fn(async () => ({
    totalViews: 10,
    members: 1,
    comments: 0,
    feeds: 2,
  })),
  getViewTrend: vi.fn(async () => []),
  getSignupTrend: vi.fn(async () => []),
  getTopFeeds: vi.fn(async () => []),
  getReadStats: vi.fn(async () => [
    {
      slug: "a",
      title: "많이 읽힌 글",
      views: 12,
      measured: 8,
      completionRate: 0.625,
      avgSeconds: 125,
    },
    {
      slug: "b",
      title: "측정 전 글",
      views: 3,
      measured: 0,
      completionRate: null,
      avgSeconds: null,
    },
  ]),
}));
vi.mock("@/lib/read-metrics", () => ({ COMPLETE_DEPTH: 90 }));

import StatsPage from "@/app/admin/stats/page";

describe("StatsPage 읽기 지표", () => {
  test("표(열·행 머리글)로 조회·측정·완독률·평균 시간, 미측정은 —", async () => {
    render(await StatsPage());
    const region = screen.getByRole("region", {
      name: "읽기 지표 (최근 30일, 조회 상위 10)",
    });
    const table = within(region).getByRole("table");
    for (const name of ["글", "조회", "측정", "완독률", "평균 읽은 시간"])
      expect(
        within(table).getByRole("columnheader", { name }),
      ).toBeInTheDocument();
    const rowA = within(table).getByRole("row", { name: /많이 읽힌 글/ });
    expect(rowA).toHaveTextContent("63%");
    expect(rowA).toHaveTextContent("2분 5초");
    expect(
      within(rowA).getByRole("link", { name: "많이 읽힌 글" }),
    ).toHaveAttribute("href", "/feed/a");
    const rowB = within(table).getByRole("row", { name: /측정 전 글/ });
    expect(within(rowB).getAllByText("—")).toHaveLength(2);
  });
});
