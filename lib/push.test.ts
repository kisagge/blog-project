import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { setupTestDb } from "@/lib/test-db";

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
    endpoint: "https://fcm.googleapis.com/fcm/send/a",
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
      endpoint: "https://fcm.googleapis.com/fcm/send/dead1",
      keys: { p256dh: "x", auth: "y" },
    });
    await push.saveSubscription(userId, {
      endpoint: "https://fcm.googleapis.com/fcm/send/dead2",
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
            "https://fcm.googleapis.com/fcm/send/dead1",
            "https://fcm.googleapis.com/fcm/send/dead2",
          ]),
        },
      },
    });
    // DB 상태: 죽은 구독은 제거, 살아있는 a는 유지
    expect(
      await prisma.pushSubscription.findUnique({
        where: { endpoint: "https://fcm.googleapis.com/fcm/send/dead1" },
      }),
    ).toBeNull();
    expect(
      await prisma.pushSubscription.findUnique({
        where: { endpoint: "https://fcm.googleapis.com/fcm/send/a" },
      }),
    ).not.toBeNull();
    delSpy.mockRestore();
  });

  test("저장돼 있던 비허용 endpoint(내부 주소 등)는 발송하지 않고 정리", async () => {
    await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: "http://127.0.0.1:3010/api/internal",
        p256dh: "x",
        auth: "y",
      },
    });
    sendNotification.mockReset();
    sendNotification.mockResolvedValue(undefined);
    await push.sendToUser(userId, { title: "t", body: "b" });
    const sent = sendNotification.mock.calls.map(
      (c) => (c[0] as { endpoint: string }).endpoint,
    );
    expect(sent).not.toContain("http://127.0.0.1:3010/api/internal");
    expect(
      await prisma.pushSubscription.findUnique({
        where: { endpoint: "http://127.0.0.1:3010/api/internal" },
      }),
    ).toBeNull();
  });

  test("회원당 구독은 최근 MAX_SUBSCRIPTIONS개만 유지", async () => {
    const u = await prisma.user.create({
      data: { email: "many@x.com", nickname: "Many", passwordHash: "-" },
    });
    for (let i = 0; i < push.MAX_SUBSCRIPTIONS + 5; i++) {
      await push.saveSubscription(u.id, {
        endpoint: `https://fcm.googleapis.com/fcm/send/many-${i}`,
        keys: { p256dh: "x", auth: "y" },
      });
    }
    const rows = await prisma.pushSubscription.findMany({
      where: { userId: u.id },
    });
    expect(rows).toHaveLength(push.MAX_SUBSCRIPTIONS);
    // 가장 최근 것은 남아 있음
    expect(rows.map((r) => r.endpoint)).toContain(
      `https://fcm.googleapis.com/fcm/send/many-${push.MAX_SUBSCRIPTIONS + 4}`,
    );
  });

  test("removeSubscription: 본인 구독만 삭제", async () => {
    const other = await prisma.user.create({
      data: { email: "other@x.com", nickname: "O", passwordHash: "-" },
    });
    const ep = "https://fcm.googleapis.com/fcm/send/others";
    await push.saveSubscription(other.id, {
      endpoint: ep,
      keys: { p256dh: "x", auth: "y" },
    });
    await push.removeSubscription(userId, ep); // 남의 구독
    expect(
      await prisma.pushSubscription.findUnique({ where: { endpoint: ep } }),
    ).not.toBeNull();
    await push.removeSubscription(other.id, ep);
    expect(
      await prisma.pushSubscription.findUnique({ where: { endpoint: ep } }),
    ).toBeNull();
  });
});
