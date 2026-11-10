import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/site-config", () => ({ guardPublicAccess: vi.fn() }));

import ArchiveLayout from "@/app/archive/layout";
import { guardPublicAccess } from "@/lib/site-config";

describe("ArchiveLayout", () => {
  test("점검 모드 가드를 먼저 실행(제목 목록이 점검 중 노출되지 않게)", async () => {
    await ArchiveLayout({ children: null });
    expect(guardPublicAccess).toHaveBeenCalledOnce();
  });
});
