import { vi } from "vitest";
vi.mock("@/lib/dal", () => ({ verifySession: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";

let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma;
});
afterAll(async () => {
  await cleanup();
});

describe("saveAboutAction", () => {
  const fd = (content: string) => {
    const f = new FormData();
    f.set("content", content);
    return f;
  };

  test("관리자 세션 확인 후 저장 + 감사 로그 + 레이아웃 재검증", async () => {
    const { saveAboutAction } = await import("@/app/admin/site-actions");
    const { verifySession } = await import("@/lib/dal");
    const { logAudit } = await import("@/lib/audit");
    const { revalidatePath } = await import("next/cache");

    await expect(
      saveAboutAction({}, fd("# 소개\n\n반가워요")),
    ).resolves.toEqual({ done: true });
    expect(verifySession).toHaveBeenCalled();
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    expect(row?.aboutContent).toBe("# 소개\n\n반가워요");
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "site.about", targetType: "site" }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("길이 초과는 저장하지 않고 에러 반환", async () => {
    const { saveAboutAction } = await import("@/app/admin/site-actions");
    const { ABOUT_MAX_LENGTH } = await import("@/lib/validation");
    const res = await saveAboutAction({}, fd("x".repeat(ABOUT_MAX_LENGTH + 1)));
    expect(res?.error).toMatch(/이하로 입력/);
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    expect(row?.aboutContent).toBe("# 소개\n\n반가워요"); // 이전 값 유지
  });
});
