import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/views", () => ({
  trackFeedView: vi.fn(),
  trackDfView: vi.fn(),
  trackSiteVisit: vi.fn(),
}));
vi.mock("@/lib/dal", () => ({ getViewerRole: vi.fn(async () => "anon") }));
vi.mock("@/lib/feed-access", () => ({ getReadableFeed: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn() }));

import { trackViewAction } from "@/app/actions/views";
import { trackFeedView, trackDfView } from "@/lib/views";
import { getReadableFeed } from "@/lib/feed-access";
import { getClientIp } from "@/lib/client-ip";
import { ACTION_LIMITS } from "@/lib/rate-limit";

const gf = vi.mocked(getReadableFeed);
const gci = vi.mocked(getClientIp);

beforeEach(() => {
  vi.clearAllMocks();
  gf.mockResolvedValue({ id: "f1", slug: "s" });
});

describe("trackViewAction", () => {
  test("읽을 수 있는 글이면 DB 글 id로 집계", async () => {
    gci.mockResolvedValue("view-ok");
    await trackViewAction("feed", "f1");
    expect(gf).toHaveBeenCalledWith("f1", "anon");
    expect(trackFeedView).toHaveBeenCalledWith("f1");
  });

  test("비공개·숨김 등 읽을 수 없는 글은 집계하지 않음", async () => {
    gci.mockResolvedValue("view-hidden");
    gf.mockResolvedValue(null);
    await trackViewAction("feed", "secret");
    expect(trackFeedView).not.toHaveBeenCalled();
  });

  test("IP당 한도 초과 시 집계하지 않음(쿠키 없이 반복 호출로 부풀리기 방지)", async () => {
    gci.mockResolvedValue("view-flood");
    const { limit } = ACTION_LIMITS.view;
    for (let i = 0; i < limit + 5; i++) await trackViewAction("feed", "f1");
    expect(trackFeedView).toHaveBeenCalledTimes(limit);
    for (let i = 0; i < 3; i++) await trackViewAction("df", "d1");
    expect(trackDfView).not.toHaveBeenCalled();
  });
});
