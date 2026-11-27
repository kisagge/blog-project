// @vitest-environment node
// 조회·방문 기록 수신. 서버 액션에서 쿠키를 발급하면 Next가 현재 페이지를 다시 렌더하므로
// Route Handler로 받는다. 모든 기록에 IP당 요청 제한(사이트 방문 포함).
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/views", () => ({
  trackFeedView: vi.fn(),
  trackDfView: vi.fn(),
  trackSiteVisit: vi.fn(),
}));
vi.mock("@/lib/dal", () => ({ getViewerRole: vi.fn(async () => "anon") }));
vi.mock("@/lib/feed-access", () => ({ getReadableFeed: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn() }));

import { POST } from "@/app/api/view/route";
import { trackDfView, trackFeedView, trackSiteVisit } from "@/lib/views";
import { getReadableFeed } from "@/lib/feed-access";
import { getClientIp } from "@/lib/client-ip";
import { ACTION_LIMITS } from "@/lib/rate-limit";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/view", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getReadableFeed).mockResolvedValue({ id: "db-f1", slug: "s" });
});

describe("POST /api/view", () => {
  test("사이트 방문·던파 조회 기록 → 204", async () => {
    vi.mocked(getClientIp).mockResolvedValue("ip-ok");
    expect((await post({ type: "site" })).status).toBe(204);
    expect(trackSiteVisit).toHaveBeenCalled();
    expect((await post({ type: "df", id: "d1" })).status).toBe(204);
    expect(trackDfView).toHaveBeenCalledWith("d1");
  });

  test("글: 읽을 수 있는 글만 DB id로 집계", async () => {
    vi.mocked(getClientIp).mockResolvedValue("ip-feed");
    await post({ type: "feed", id: "f1" });
    expect(trackFeedView).toHaveBeenCalledWith("db-f1");
    vi.mocked(getReadableFeed).mockResolvedValue(null);
    await post({ type: "feed", id: "private" });
    expect(trackFeedView).toHaveBeenCalledTimes(1);
  });

  test("형식이 틀린 본문은 400", async () => {
    vi.mocked(getClientIp).mockResolvedValue("ip-bad");
    expect((await post("not json")).status).toBe(400);
    expect((await post({ type: "user", id: "x" })).status).toBe(400);
    expect((await post({ type: "feed" })).status).toBe(400);
  });

  test("사이트 방문도 IP당 한도 — 쿠키 없이 반복 호출로 방문 기록을 무한히 쌓지 못하게", async () => {
    vi.mocked(getClientIp).mockResolvedValue("ip-flood");
    for (let i = 0; i < ACTION_LIMITS.view.limit; i++)
      await post({ type: "site" });
    expect((await post({ type: "site" })).status).toBe(429);
    expect(trackSiteVisit).toHaveBeenCalledTimes(ACTION_LIMITS.view.limit);
  });
});
