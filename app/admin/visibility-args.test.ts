// 서버 액션 인자는 클라이언트가 임의로 보낼 수 있다 — 공개 범위 변경 액션이 허용값 외를 DB에 쓰지 않는지.
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/dal", () => ({ verifySession: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setupTestDb } from "@/lib/test-db";
import { makeFeed } from "@/lib/test-factories";

let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let cleanup: () => Promise<void>;
let feedActions: typeof import("@/app/admin/actions");
let dfActions: typeof import("@/app/admin/df/actions");

beforeAll(async () => {
  const db = await setupTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  feedActions = await import("@/app/admin/actions");
  dfActions = await import("@/app/admin/df/actions");
});
afterAll(async () => {
  await cleanup();
});

const BAD = ["admin-only", "", "PUBLIC"] as unknown as "public"[];

describe("공개 범위 액션 인자 검증", () => {
  test("글: 허용값 외는 무시(변경 없음), 허용값은 반영", async () => {
    const f = await makeFeed(prisma, { visibility: "members" });
    for (const v of BAD) await feedActions.setFeedVisibility(f.id, v);
    expect(
      (await prisma.feed.findUnique({ where: { id: f.id } }))?.visibility,
    ).toBe("members");
    await feedActions.setFeedVisibility(f.id, "private");
    expect(
      (await prisma.feed.findUnique({ where: { id: f.id } }))?.visibility,
    ).toBe("private");
  });

  test("던파 캐릭터: 허용값 외는 무시, 허용값은 반영", async () => {
    const c = await prisma.dfCharacter.create({
      data: {
        serverId: "cain",
        characterId: "abc",
        characterName: "캐릭",
        visibility: "public",
      },
    });
    for (const v of BAD) await dfActions.setDfVisibilityAction(c.id, v);
    expect(
      (await prisma.dfCharacter.findUnique({ where: { id: c.id } }))
        ?.visibility,
    ).toBe("public");
    await dfActions.setDfVisibilityAction(c.id, "members");
    expect(
      (await prisma.dfCharacter.findUnique({ where: { id: c.id } }))
        ?.visibility,
    ).toBe("members");
  });
});
