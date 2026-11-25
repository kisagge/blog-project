import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FakeEventSource } from "@/test/helpers";

vi.mock("@/lib/dal", () => ({ verifySession: vi.fn() }));
vi.mock("@/app/actions/auth", () => ({ logout: vi.fn() }));
vi.mock("@/lib/reports", () => ({
  countPendingReportTargets: vi.fn(async () => 0),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

// AdminNav가 신고 수 실시간 갱신에 EventSource를 쓴다(jsdom 미구현) → 테스트용 대역.
vi.stubGlobal("EventSource", FakeEventSource);

import AdminLayout from "@/app/admin/layout";
import { verifySession } from "@/lib/dal";

describe("AdminLayout", () => {
  test("세션 확인 후 관리자 페이지 본문을 main 랜드마크로 감쌈", async () => {
    render(await AdminLayout({ children: <p>본문</p> }));
    expect(verifySession).toHaveBeenCalled();
    expect(screen.getByRole("main")).toHaveTextContent("본문");
  });
});
