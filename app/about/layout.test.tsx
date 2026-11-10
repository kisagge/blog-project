import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/site-config", () => ({ guardPublicAccess: vi.fn() }));

import AboutLayout from "@/app/about/layout";
import { guardPublicAccess } from "@/lib/site-config";

describe("AboutLayout", () => {
  test("점검 모드 가드를 먼저 실행", async () => {
    await AboutLayout({ children: null });
    expect(guardPublicAccess).toHaveBeenCalledOnce();
  });
});
