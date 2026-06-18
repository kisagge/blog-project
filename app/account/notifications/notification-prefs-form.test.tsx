import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// 서버 전용 import 회피: 액션 모킹(폼 동작만 검증).
vi.mock("@/app/account/notifications/actions", () => ({
  updateNotificationPrefsAction: vi.fn(async () => ({})),
}));

import NotificationPrefsForm from "@/app/account/notifications/notification-prefs-form";

describe("NotificationPrefsForm 저장 버튼 dirty 비활성화", () => {
  test("초기엔 비활성, 토글하면 활성, 원복하면 다시 비활성", () => {
    render(
      <NotificationPrefsForm
        prefs={{ onReply: true, onComment: true, onMention: true }}
      />,
    );
    const save = screen.getByRole("button", { name: "저장" });
    expect(save).toBeDisabled(); // 변경 없음

    const replyCb = screen.getByRole("checkbox", { name: /답글 알림/ });
    fireEvent.click(replyCb); // true → false (변경 발생)
    expect(save).toBeEnabled();

    fireEvent.click(replyCb); // false → true (초기로 원복)
    expect(save).toBeDisabled();
  });
});
