import { describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/jwt", () => ({ decrypt: vi.fn(async () => null) }));

import { proxy } from "@/proxy";
import { RATE_LIMITS } from "@/lib/request-kind";

let n = 0;
const freshIp = () => `10.0.0.${++n}`;
const req = (ip: string, dest: string | null, path = "/feed", method = "GET") =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      "x-forwarded-for": ip,
      ...(dest ? { "sec-fetch-dest": dest } : {}),
    },
  });

async function exhaust(ip: string, dest: string | null, count: number) {
  for (let i = 0; i < count; i++) await proxy(req(ip, dest));
}

describe("proxy 레이트 리밋 버킷", () => {
  test("프리페치(RSC) 폭주가 문서 예산을 소진시키지 않음", async () => {
    const ip = freshIp();
    await exhaust(ip, "empty", RATE_LIMITS.default.limit + 50); // 기존 한도 초과분의 프리페치
    const doc = await proxy(req(ip, "document"));
    expect(doc.status).not.toBe(429);
  });

  test("RSC 버킷도 한도가 있음(헤더 위조로 무제한 우회 불가) — 초과 시 평문 429", async () => {
    const ip = freshIp();
    await exhaust(ip, "empty", RATE_LIMITS.rsc.limit);
    const res = await proxy(req(ip, "empty"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("10");
    expect(await res.text()).toContain("요청이 너무 많습니다");
  });

  test("문서 요청 초과 시엔 lang·title·main이 있는 HTML 429", async () => {
    const ip = freshIp();
    await exhaust(ip, "document", RATE_LIMITS.default.limit);
    const res = await proxy(req(ip, "document"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('<html lang="ko">');
    expect(html).toContain("<title>");
    expect(html).toContain("<main>");
  });

  test("서버 액션(POST)은 기존 예산을 문서와 공유", async () => {
    const ip = freshIp();
    await exhaust(ip, "document", RATE_LIMITS.default.limit);
    const action = await proxy(req(ip, "empty", "/feed", "POST"));
    expect(action.status).toBe(429);
  });

  test("X-Forwarded-For 앞부분을 매번 바꿔도(위조) 실제 IP 기준으로 한도에 걸림", async () => {
    const real = freshIp();
    for (let i = 0; i < RATE_LIMITS.default.limit; i++)
      await proxy(req(`spoof-${i}, ${real}`, "document"));
    const res = await proxy(req(`spoof-final, ${real}`, "document"));
    expect(res.status).toBe(429);
  });

  test("관리자 경로 가드는 그대로(세션 없으면 /login)", async () => {
    const res = await proxy(req(freshIp(), "document", "/admin"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });
});
