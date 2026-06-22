import { describe, expect, test } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ScheduleField from "./schedule-field";

describe("ScheduleField", () => {
  test("기본은 예약 미설정 — 캘린더 숨김, hidden scheduledAt 빈값", () => {
    const { container } = render(<ScheduleField />);
    const hidden = container.querySelector(
      'input[name="scheduledAt"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe("");
    expect(screen.queryByLabelText("예약 발행 날짜")).toBeNull();
  });

  test("예약 발행 체크 시 날짜 선택 안내 + 캘린더 노출", () => {
    render(<ScheduleField />);
    fireEvent.click(screen.getByLabelText(/예약 발행/, { selector: "input" }));
    // 날짜 미선택 → 안내 alert + time 입력 노출
    expect(screen.getByRole("alert")).toHaveTextContent("날짜를 선택하세요");
    expect(screen.getByLabelText(/시간/)).toBeTruthy();
  });
});
