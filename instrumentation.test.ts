// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import { onRequestError } from "@/instrumentation";

const ctx = {
  routerKind: "App Router",
  routePath: "/feed/[slug]",
  routeType: "render",
  renderSource: "server-rendering",
  revalidateReason: undefined,
} as const;

afterEach(() => vi.restoreAllMocks());

describe("onRequestError", () => {
  test("어느 요청에서 난 오류인지 한 줄(메서드·경로·라우트·digest)로 남김", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("boom"), { digest: "123" });
    await onRequestError(
      err,
      { path: "/feed/hello?token=secret&x=1", method: "GET", headers: {} },
      ctx,
    );
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0][0]);
    expect(line).toBe(
      "[request-error] GET /feed/hello route=/feed/[slug] type=render digest=123",
    );
    expect(line).not.toContain("secret"); // 쿼리(토큰 등)는 기록하지 않음
  });

  test("digest 없는 오류(라우트 핸들러 등)도 기록", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await onRequestError(
      new Error("x"),
      { path: "/api/x", method: "POST", headers: {} },
      { ...ctx, routePath: "/api/x", routeType: "route" },
    );
    expect(String(spy.mock.calls[0][0])).toBe(
      "[request-error] POST /api/x route=/api/x type=route digest=-",
    );
  });
});
