import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/admin/upload-action", () => ({ uploadImage: vi.fn() }));

import FeedForm from "@/app/admin/feed-form";

const action = vi.fn();
beforeEach(() => {
  localStorage.clear();
  action.mockReset();
});

const KEY = "byjang-draft:admin:new";

describe("FeedForm 초안 자동저장(uncontrolled)", () => {
  test("입력 시 초안이 localStorage에 저장", async () => {
    const { container } = render(
      <FeedForm action={action} submitLabel="저장" />,
    );
    const ta = container.querySelector(
      'textarea[name="content"]',
    ) as HTMLTextAreaElement;
    fireEvent.input(ta, { target: { value: "관리자초안본문" } });
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull(), {
      timeout: 1500,
    });
    expect(localStorage.getItem(KEY)).toContain("관리자초안본문");
  });

  test("저장된 초안이 있으면 복원 배너 → 복원 시 uncontrolled 필드 값 설정", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        savedAt: Date.now(),
        data: {
          title: "제목초안",
          slug: "",
          summary: "",
          content: "본문초안",
          visibility: "private",
          tags: "",
        },
      }),
    );
    const { container } = render(
      <FeedForm action={action} submitLabel="저장" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "복원" }));
    expect(
      (container.querySelector('input[name="title"]') as HTMLInputElement)
        .value,
    ).toBe("제목초안");
    expect(
      (
        container.querySelector(
          'textarea[name="content"]',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("본문초안");
  });
});
