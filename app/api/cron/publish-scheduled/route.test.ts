import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { publishDueFeeds } = vi.hoisted(() => ({
  publishDueFeeds: vi.fn(async () => 3),
}));
vi.mock("@/lib/scheduled", () => ({ publishDueFeeds }));

import { POST } from "./route";

const req = (secret?: string) =>
  new Request("http://127.0.0.1:3010/api/cron/publish-scheduled", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : {},
  });

const orig = process.env.CRON_SECRET;
beforeEach(() => {
  publishDueFeeds.mockClear();
  process.env.CRON_SECRET = "s3cr3t-value";
});
afterEach(() => {
  process.env.CRON_SECRET = orig;
});

describe("POST /api/cron/publish-scheduled", () => {
  test("시크릿 없음 → 401, publishDueFeeds 미호출", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(publishDueFeeds).not.toHaveBeenCalled();
  });

  test("시크릿 불일치 → 401", async () => {
    const res = await POST(req("wrong"));
    expect(res.status).toBe(401);
    expect(publishDueFeeds).not.toHaveBeenCalled();
  });

  test("시크릿 일치 → 200 + 발행 수", async () => {
    const res = await POST(req("s3cr3t-value"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ published: 3 });
    expect(publishDueFeeds).toHaveBeenCalledTimes(1);
  });

  test("CRON_SECRET 미설정 → 401(비활성)", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req("s3cr3t-value"));
    expect(res.status).toBe(401);
    expect(publishDueFeeds).not.toHaveBeenCalled();
  });
});
