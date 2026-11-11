import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import DiffView from "@/app/admin/diff-view";

describe("DiffView", () => {
  test("추가는 ins, 삭제는 del + 보조기술용 라벨, 접힌 구간은 줄 수", () => {
    const { container } = render(
      <DiffView
        rows={[
          { type: "skip", count: 5 },
          { type: "del", text: "옛 줄" },
          { type: "add", text: "새 줄" },
          { type: "same", text: "그대로" },
        ]}
      />,
    );
    expect(container.querySelector("del")).toHaveTextContent("삭제: 옛 줄");
    expect(container.querySelector("ins")).toHaveTextContent("추가: 새 줄");
    expect(screen.getByText("… 동일한 5줄 생략")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  test("변경이 없으면 안내 문구", () => {
    render(<DiffView rows={[{ type: "skip", count: 3 }]} />);
    expect(screen.getByText("본문 변경 없음")).toBeInTheDocument();
  });
});
