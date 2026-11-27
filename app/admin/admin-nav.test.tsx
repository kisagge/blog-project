import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("@/app/ui/use-server-event", () => ({ useServerEvent: vi.fn() }));

import AdminNav from "@/app/admin/admin-nav";

describe("AdminNav 배지", () => {
  test("가입 대기·미처리 신고 수를 링크 이름에 포함(일반 span의 aria-label 대신 화면 낭독기용 텍스트)", () => {
    const { container } = render(
      <AdminNav pendingReports={2} pendingMembers={3} />,
    );
    expect(
      screen.getByRole("link", { name: /회원.*가입 대기 3건/ }),
    ).toHaveAttribute("href", "/admin/members");
    expect(
      screen.getByRole("link", { name: /신고.*미처리 신고 2건/ }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("span[aria-label]")).toHaveLength(0);
  });

  test("0건이면 배지 없음", () => {
    render(<AdminNav pendingReports={0} pendingMembers={0} />);
    expect(screen.getByRole("link", { name: "회원" })).toBeInTheDocument();
  });
});
