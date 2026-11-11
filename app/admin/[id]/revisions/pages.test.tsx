import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/feeds", () => ({ getFeedById: vi.fn() }));
vi.mock("@/lib/revisions", () => ({
  REVISION_LIMIT: 20,
  listRevisions: vi.fn(),
  getRevision: vi.fn(),
}));
vi.mock("@/app/admin/actions", () => ({ restoreRevisionAction: vi.fn() }));

import RevisionsPage from "@/app/admin/[id]/revisions/page";
import RevisionPage from "@/app/admin/[id]/revisions/[revId]/page";
import { getFeedById } from "@/lib/feeds";
import { getRevision, listRevisions } from "@/lib/revisions";

const feed = {
  id: "f1",
  title: "현재 제목",
  summary: "요약",
  content: "첫 줄\n새 둘째 줄\n셋째 줄",
};
vi.mocked(getFeedById).mockResolvedValue(feed as never);

const args = (p: object, s: object = {}) => ({
  params: Promise.resolve(p),
  searchParams: Promise.resolve(s),
});

describe("수정 이력 목록", () => {
  test("최신순 목록(시각 time·글자 수·비교 링크) + 되돌리기 결과 status", async () => {
    vi.mocked(listRevisions).mockResolvedValue([
      {
        id: "r2",
        title: "두 번째",
        createdAt: new Date("2026-11-11T01:00:00Z"),
        length: 1234,
      },
    ]);
    const { container } = render(
      await RevisionsPage(args({ id: "f1" }, { restored: "1" }) as never),
    );
    expect(screen.getByRole("heading", { level: 1, name: "수정 이력" }));
    // 같은 제목 이력 구별을 위해 시각·길이까지 링크 이름에 포함
    expect(
      screen.getByRole("link", { name: /^두 번째 .+까지의 버전 · 1,234자$/ }),
    ).toHaveAttribute("href", "/admin/f1/revisions/r2");
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-11-11T01:00:00.000Z",
    );
    expect(screen.getByText(/1,234자/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "이전 버전으로 되돌렸습니다",
    );
  });

  test("이력이 없으면 안내", async () => {
    vi.mocked(listRevisions).mockResolvedValue([]);
    render(await RevisionsPage(args({ id: "f1" }) as never));
    expect(screen.getByText("아직 수정 이력이 없습니다.")).toBeInTheDocument();
  });
});

describe("이력 비교", () => {
  test("이 버전 → 현재: 제목 변경·본문 줄 diff·통계 + 되돌리기 버튼", async () => {
    vi.mocked(getRevision).mockResolvedValue({
      id: "r1",
      feedId: "f1",
      title: "옛 제목",
      summary: "요약",
      content: "첫 줄\n옛 둘째 줄\n셋째 줄",
      createdAt: new Date("2026-11-10T00:00:00Z"),
    });
    const { container } = render(
      await RevisionPage(args({ id: "f1", revId: "r1" }) as never),
    );
    expect(screen.getByText("옛 제목 → 현재 제목")).toBeInTheDocument();
    const body = screen.getByRole("region", { name: /본문/ });
    expect(within(body).getByText(/추가 1줄 · 삭제 1줄/)).toBeInTheDocument();
    expect(container.querySelector("del")).toHaveTextContent("옛 둘째 줄");
    expect(container.querySelector("ins")).toHaveTextContent("새 둘째 줄");
    expect(
      screen.getByRole("button", { name: "이 버전으로 되돌리기" }),
    ).toBeInTheDocument();
  });

  test("다른 글의 이력 id면 404", async () => {
    vi.mocked(getRevision).mockResolvedValue({
      id: "r9",
      feedId: "other",
      title: "x",
      summary: null,
      content: "x",
      createdAt: new Date(),
    });
    await expect(
      RevisionPage(args({ id: "f1", revId: "r9" }) as never),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
