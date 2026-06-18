import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DraftRestoreBanner from "@/app/draft-restore-banner";

describe("DraftRestoreBanner", () => {
  test("복원·무시 버튼이 각 콜백을 호출", () => {
    const onRestore = vi.fn();
    const onDismiss = vi.fn();
    render(<DraftRestoreBanner onRestore={onRestore} onDismiss={onDismiss} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "복원" }));
    expect(onRestore).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "무시" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
