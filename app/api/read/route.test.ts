import { beforeEach, describe, expect, test, vi } from "vitest";

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));
vi.mock("@/lib/read-metrics", async () => {
  const { z } = await import("zod");
  return {
    ReadBeaconSchema: z.object({
      feedId: z.string().min(1),
      depth: z.number().int().min(0).max(100),
      seconds: z.number().int().min(0).max(600),
    }),
    recordRead: vi.fn(async () => true),
  };
});

import { POST } from "@/app/api/read/route";
import { recordRead } from "@/lib/read-metrics";

const post = (body: string) =>
  POST(new Request("http://x/api/read", { method: "POST", body }));

beforeEach(() => {
  cookieGet.mockReset();
  vi.mocked(recordRead).mockClear();
});

describe("POST /api/read", () => {
  test("방문자 쿠키가 있으면 검증된 비콘을 기록하고 204", async () => {
    cookieGet.mockReturnValue({ value: "vid-1" });
    const res = await post(
      JSON.stringify({ feedId: "f1", depth: 80, seconds: 20 }),
    );
    expect(res.status).toBe(204);
    expect(recordRead).toHaveBeenCalledWith("vid-1", {
      feedId: "f1",
      depth: 80,
      seconds: 20,
    });
  });

  test("방문자 쿠키가 없으면(타 사이트발·조회 기록 없음) 기록 없이 204", async () => {
    cookieGet.mockReturnValue(undefined);
    const res = await post(
      JSON.stringify({ feedId: "f1", depth: 80, seconds: 20 }),
    );
    expect(res.status).toBe(204);
    expect(recordRead).not.toHaveBeenCalled();
  });

  test("깨진 JSON·범위 밖 값은 400, 기록 안 함", async () => {
    cookieGet.mockReturnValue({ value: "vid-1" });
    expect((await post("{not json")).status).toBe(400);
    expect(
      (await post(JSON.stringify({ feedId: "f1", depth: 500, seconds: 1 })))
        .status,
    ).toBe(400);
    expect(recordRead).not.toHaveBeenCalled();
  });
});
