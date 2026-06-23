import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";

vi.mock("server-only", () => ({}));
const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
}));

type Push = typeof import("@/lib/push");
type Prisma = (typeof import("@/lib/prisma"))["prisma"];
let push: Push;
let prisma: Prisma;
let cleanup: () => Promise<void>;
let userId: string;

beforeAll(async () => {
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  sendNotification.mockResolvedValue(undefined);
  const db = await setupTestDb();
  cleanup = db.cleanup;
  prisma = db.prisma as Prisma;
  push = await import("@/lib/push");
  const u = await prisma.user.create({
    data: { email: "a@x.com", nickname: "A", passwordHash: "-" },
  });
  userId = u.id;
  await push.saveSubscription(userId, {
    endpoint: "https://push/a",
    keys: { p256dh: "x", auth: "y" },
  });
});
afterAll(async () => {
  await cleanup();
});

describe("push", () => {
  test("saveSubscription: 저장됨(endpoint 유니크)", async () => {
    expect(await prisma.pushSubscription.count({ where: { userId } })).toBe(1);
  });

  test("sendToUser: 구독자에게 web-push 발송", async () => {
    sendNotification.mockClear();
    sendNotification.mockResolvedValue(undefined);
    await push.sendToUser(userId, { title: "t", body: "b" });
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  test("sendToUser: 만료(410) 구독 여럿 → 단일 deleteMany로 일괄 정리", async () => {
    // 만료될 구독 2개 추가(살아있는 a는 유지되어야 함)
    await push.saveSubscription(userId, {
      endpoint: "https://push/dead1",
      keys: { p256dh: "x", auth: "y" },
    });
    await push.saveSubscription(userId, {
      endpoint: "https://push/dead2",
      keys: { p256dh: "x", auth: "y" },
    });
    sendNotification.mockReset();
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.includes("dead")) {
        const e = new Error("gone") as Error & { statusCode: number };
        e.statusCode = 410;
        throw e;
      }
    });
    const delSpy = vi.spyOn(prisma.pushSubscription, "deleteMany");

    await push.sendToUser(userId, { title: "t", body: "b" });

    // 건별이 아니라 단 1번, in 절로 죽은 endpoint만 삭제
    expect(delSpy).toHaveBeenCalledTimes(1);
    expect(delSpy.mock.calls[0][0]).toEqual({
      where: {
        endpoint: {
          in: expect.arrayContaining([
            "https://push/dead1",
            "https://push/dead2",
          ]),
        },
      },
    });
    // DB 상태: 죽은 구독은 제거, 살아있는 a는 유지
    expect(
      await prisma.pushSubscription.findUnique({
        where: { endpoint: "https://push/dead1" },
      }),
    ).toBeNull();
    expect(
      await prisma.pushSubscription.findUnique({
        where: { endpoint: "https://push/a" },
      }),
    ).not.toBeNull();
    delSpy.mockRestore();
  });
});
