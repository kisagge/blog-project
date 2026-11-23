import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/admin/series/actions", () => ({}));

import SeriesForm from "@/app/admin/series/series-form";

describe("SeriesForm 접근성", () => {
  test("필드 오류는 role=alert로 알리고 해당 입력에 연결", async () => {
    const action = vi.fn(async () => ({
      errors: { slug: ["이미 사용 중인 slug입니다."] },
    }));
    render(<SeriesForm action={action} submitLabel="만들기" />);
    expect(screen.getByLabelText("설명 (선택)")).toHaveAttribute(
      "name",
      "description",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    });
    const alert = await screen.findByRole("alert");
    const slug = screen.getByLabelText("slug (소문자·숫자·하이픈)");
    expect(slug).toHaveAttribute("aria-invalid", "true");
    expect(slug).toHaveAttribute("aria-describedby", alert.id);
    expect(alert).toHaveTextContent("이미 사용 중인 slug입니다.");
  });
});
