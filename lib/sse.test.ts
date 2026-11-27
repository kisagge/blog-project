import { afterEach, describe, expect, test, vi } from "vitest";
import { sseEvent, sseResponse } from "@/lib/sse";

const decoder = new TextDecoder();

// 스트림에서 n개 청크를 읽어 문자열로.
async function readChunks(res: Response, n: number): Promise<string[]> {
  const reader = res.body!.getReader();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const { value, done } = await reader.read();
    if (done) break;
    out.push(decoder.decode(value));
  }
  reader.releaseLock();
  return out;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("sseEvent", () => {
  test("이름 있는 이벤트와 data 전용 메시지 형식", () => {
    expect(sseEvent(3, "unread")).toBe("event: unread\ndata: 3\n\n");
    expect(sseEvent({ a: 1 })).toBe('data: {"a":1}\n\n');
  });
});

describe("sseResponse", () => {
  test("SSE 헤더 + 연결 주석 + setup이 보낸 메시지", async () => {
    const ac = new AbortController();
    const res = sseResponse(ac.signal, (send) => {
      send(sseEvent(1, "unread"));
      return [];
    });
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    expect(await readChunks(res, 2)).toEqual([
      ": connected\n\n",
      "event: unread\ndata: 1\n\n",
    ]);
    ac.abort();
  });

  test("요청 중단 시 구독 해제 + 하트비트 정지 + 스트림 종료", async () => {
    vi.useFakeTimers();
    const ac = new AbortController();
    const unsub = vi.fn();
    const res = sseResponse(ac.signal, () => [unsub], { heartbeatMs: 1000 });
    const reader = res.body!.getReader();
    await reader.read(); // connected
    vi.advanceTimersByTime(1000);
    expect(decoder.decode((await reader.read()).value)).toBe(": ping\n\n");
    ac.abort();
    expect(unsub).toHaveBeenCalledTimes(1);
    expect((await reader.read()).done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("이미 중단된 요청이면 setup을 부르지 않고 바로 종료", async () => {
    const ac = new AbortController();
    ac.abort();
    const setup = vi.fn(() => []);
    const res = sseResponse(ac.signal, setup);
    expect(setup).not.toHaveBeenCalled();
    expect((await res.body!.getReader().read()).done).toBe(true);
  });

  test("클라이언트가 스트림을 취소해도 구독 해제", async () => {
    const ac = new AbortController();
    const unsub = vi.fn();
    const res = sseResponse(ac.signal, () => [unsub]);
    await res.body!.cancel();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});

describe("sseResponse 동시 연결 상한", () => {
  test("같은 키(IP)는 perKey개까지, 넘으면 429 — 연결이 끝나면 자리 반납", async () => {
    const acs = [new AbortController(), new AbortController()];
    const ok = acs.map((ac) =>
      sseResponse(ac.signal, () => [], { key: "1.1.1.1", perKey: 2 }),
    );
    expect(ok.map((r) => r.status)).toEqual([200, 200]);
    const over = sseResponse(new AbortController().signal, () => [], {
      key: "1.1.1.1",
      perKey: 2,
    });
    expect(over.status).toBe(429);
    expect(over.headers.get("Retry-After")).toBeTruthy();
    // 다른 IP는 영향 없음
    const other = new AbortController();
    expect(
      sseResponse(other.signal, () => [], { key: "2.2.2.2", perKey: 2 }).status,
    ).toBe(200);
    acs[0].abort(); // 한 연결 종료 → 자리 반납
    acs[0].abort(); // 중복 종료 신호에도 한 번만 반납
    const again = new AbortController();
    expect(
      sseResponse(again.signal, () => [], { key: "1.1.1.1", perKey: 2 }).status,
    ).toBe(200);
    expect(
      sseResponse(new AbortController().signal, () => [], {
        key: "1.1.1.1",
        perKey: 2,
      }).status,
    ).toBe(429);
    for (const ac of [acs[1], other, again]) ac.abort();
  });
});
