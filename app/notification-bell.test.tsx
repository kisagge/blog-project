import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(() => "/"),
}));
vi.mock("next/navigation", () => ({ usePathname: mockUsePathname }));

import NotificationBell from "@/app/notification-bell";

// jsdom엔 EventSource가 없어 no-op 가짜 주입(벨은 addEventListener("unread")만 사용).
class FakeEventSource {
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener() {}
  close() {}
}

describe("NotificationBell 종 ↔ 알림 설정 톱니바퀴", () => {
  const orig = globalThis.EventSource;
  beforeEach(() => {
    // @ts-expect-error 테스트용 주입
    globalThis.EventSource = FakeEventSource;
    mockUsePathname.mockReturnValue("/");
  });
  afterEach(() => {
    globalThis.EventSource = orig;
  });

  test("회원 + /notifications → 알림 설정 톱니바퀴", () => {
    mockUsePathname.mockReturnValue("/notifications");
    render(<NotificationBell initialUnread={0} isMember />);
    expect(screen.getByRole("link", { name: "알림 설정" })).toHaveAttribute(
      "href",
      "/account/notifications",
    );
  });

  test("회원 + 다른 경로 → 종(알림 링크)", () => {
    mockUsePathname.mockReturnValue("/");
    render(<NotificationBell initialUnread={3} isMember />);
    expect(screen.queryByRole("link", { name: "알림 설정" })).toBeNull();
    expect(screen.getByRole("link", { name: /알림/ })).toHaveAttribute(
      "href",
      "/notifications",
    );
  });

  test("관리자(isMember=false) + /notifications → 종 유지(톱니바퀴 미노출)", () => {
    mockUsePathname.mockReturnValue("/notifications");
    render(<NotificationBell initialUnread={0} isMember={false} />);
    expect(screen.queryByRole("link", { name: "알림 설정" })).toBeNull();
    expect(screen.getByRole("link", { name: /알림/ })).toHaveAttribute(
      "href",
      "/notifications",
    );
  });
});
