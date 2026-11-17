import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/dal", () => ({ getMemberSession: vi.fn() }));
vi.mock("@/lib/push", () => ({
  saveSubscription: vi.fn(),
  removeSubscription: vi.fn(),
}));

import { subscribePush, unsubscribePush } from "@/app/actions/push";
import { getMemberSession } from "@/lib/dal";
import { saveSubscription, removeSubscription } from "@/lib/push";
import { ACTION_LIMITS } from "@/lib/rate-limit";

const gms = vi.mocked(getMemberSession);
const P256 = "B" + "A".repeat(86); // 87자 base64url(65바이트 공개키 길이)
const AUTH = "C".repeat(22); // 22자 base64url(16바이트)
const sub = (endpoint: string, keys = { p256dh: P256, auth: AUTH }) => ({
  endpoint,
  keys,
});
let uid = 0;
const login = () =>
  gms.mockResolvedValue({
    role: "member",
    userId: `u${++uid}`,
    nickname: "n",
  } as Awaited<ReturnType<typeof getMemberSession>>);

beforeEach(() => {
  vi.clearAllMocks();
  login();
});

describe("subscribePush", () => {
  test("브라우저 푸시 서비스 구독은 저장", async () => {
    const s = sub("https://fcm.googleapis.com/fcm/send/abc");
    expect(await subscribePush(s)).toEqual({ ok: true });
    expect(saveSubscription).toHaveBeenCalledWith(expect.any(String), s);
  });

  test("SSRF: 내부·임의 주소 endpoint는 저장하지 않음", async () => {
    for (const ep of [
      "http://127.0.0.1:3010/api/events",
      "https://169.254.169.254/latest/meta-data",
      "https://attacker.example/hook",
    ])
      expect(await subscribePush(sub(ep))).toEqual({ ok: false });
    expect(saveSubscription).not.toHaveBeenCalled();
  });

  test("키 형식·길이가 어긋나면 거부", async () => {
    const ep = "https://fcm.googleapis.com/fcm/send/abc";
    for (const keys of [
      { p256dh: "x", auth: AUTH },
      { p256dh: P256, auth: "y" },
      { p256dh: P256 + "!!", auth: AUTH },
      { p256dh: "A".repeat(5000), auth: AUTH },
    ])
      expect(await subscribePush(sub(ep, keys))).toEqual({ ok: false });
    expect(
      await subscribePush({ endpoint: ep } as unknown as Parameters<
        typeof subscribePush
      >[0]),
    ).toEqual({ ok: false });
    expect(saveSubscription).not.toHaveBeenCalled();
  });

  test("비로그인 거부", async () => {
    gms.mockResolvedValue(null);
    expect(
      await subscribePush(sub("https://fcm.googleapis.com/fcm/send/a")),
    ).toEqual({ ok: false });
    expect(saveSubscription).not.toHaveBeenCalled();
  });

  test("회원별 구독 요청 한도", async () => {
    const { limit } = ACTION_LIMITS.pushSubscribe;
    for (let i = 0; i < limit + 3; i++)
      await subscribePush(sub(`https://fcm.googleapis.com/fcm/send/${i}`));
    expect(saveSubscription).toHaveBeenCalledTimes(limit);
  });
});

describe("unsubscribePush", () => {
  test("비로그인은 남의 구독을 지울 수 없음", async () => {
    gms.mockResolvedValue(null);
    expect(await unsubscribePush("https://fcm.googleapis.com/x")).toEqual({
      ok: false,
    });
    expect(removeSubscription).not.toHaveBeenCalled();
  });

  test("본인 userId 범위로만 삭제", async () => {
    await unsubscribePush("https://fcm.googleapis.com/x");
    expect(removeSubscription).toHaveBeenCalledWith(
      expect.stringMatching(/^u\d+$/),
      "https://fcm.googleapis.com/x",
    );
  });
});
