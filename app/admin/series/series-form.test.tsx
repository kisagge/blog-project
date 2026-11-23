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

describe("SeriesForm 오류 후 입력 유지", () => {
  test("서버가 돌려준 제출값으로 입력을 다시 채움(React 19 폼 초기화 대응)", async () => {
    const action = vi.fn(async () => ({
      errors: { slug: ["이미 사용 중인 slug입니다."] },
      values: { title: "새 시리즈", slug: "taken", description: "설명" },
    }));
    render(<SeriesForm action={action} submitLabel="만들기" />);
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "새 시리즈" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    });
    await screen.findByRole("alert");
    expect(screen.getByLabelText("제목")).toHaveValue("새 시리즈");
    expect(screen.getByLabelText("slug (소문자·숫자·하이픈)")).toHaveValue(
      "taken",
    );
    expect(screen.getByLabelText("설명 (선택)")).toHaveValue("설명");
  });
});
