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
    await push.sendToUser(userId, { title: "t", body: "b" });
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});
