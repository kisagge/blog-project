// SSE(Server-Sent Events) 응답 공용. 알림·피드 이벤트 라우트가 같은 스트림 수명주기를 쓴다:
// 연결 주석 → setup이 초기값 전송·구독 → 주기 핑 → 요청 중단/스트림 취소 시 구독 해제·핑 정지·종료.

const HEARTBEAT_MS = 25_000; // nginx idle 타임아웃·프록시 버퍼링 회피용 주기 핑

// 동시 연결 상한. 요청 수 제한(proxy)은 "열려 있는" 연결 수를 세지 못해, 한 IP가 스트림 수백 개를
// 열어 두면 nginx 연결과 메모리를 다 쓴다. 탭당 최대 2개(알림·글)라 IP당 20이면 정상 사용엔 넉넉.
// 모듈이 라우트 번들마다 따로 평가될 수 있어 lib/events와 같이 globalThis에 둔다.
const MAX_PER_KEY = 20;
const MAX_TOTAL = 500;
const g = globalThis as unknown as {
  __sseConns?: { byKey: Map<string, number>; total: number };
};
const conns = (g.__sseConns ??= { byKey: new Map(), total: 0 });

// 자리 확보(없으면 null). 반환한 release는 여러 번 불러도 한 번만 반납.
function acquire(key: string, perKey: number): (() => void) | null {
  const n = conns.byKey.get(key) ?? 0;
  if (n >= perKey || conns.total >= MAX_TOTAL) return null;
  conns.byKey.set(key, n + 1);
  conns.total++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (conns.byKey.get(key) ?? 1) - 1;
    if (left <= 0) conns.byKey.delete(key);
    else conns.byKey.set(key, left);
    conns.total--;
  };
}

// SSE 메시지 1건. 이름 있으면 `event:` 줄 추가, 문자열이 아닌 값은 JSON.
export function sseEvent(data: unknown, event?: string): string {
  const body =
    typeof data === "string" || typeof data === "number"
      ? String(data)
      : JSON.stringify(data);
  return `${event ? `event: ${event}\n` : ""}data: ${body}\n\n`;
}

// setup: 연결 직후 동기로 호출(초기값 전송·구독). 반환한 해제 함수들은 연결 종료 시 호출.
// 초기값 조회 같은 비동기 작업은 호출 전에 끝내 둘 것(start를 동기로 유지 → 중단 경합 없음).
// key(보통 클라이언트 IP)를 주면 동시 연결 상한을 적용 — 넘으면 429(EventSource는 재연결을 멈춤).
export function sseResponse(
  signal: AbortSignal,
  setup: (send: (chunk: string) => void) => Array<() => void>,
  {
    heartbeatMs = HEARTBEAT_MS,
    key,
    perKey = MAX_PER_KEY,
  }: { heartbeatMs?: number; key?: string; perKey?: number } = {},
): Response {
  const release = key ? acquire(key, perKey) : () => {};
  if (!release)
    return new Response("Too Many Connections", {
      status: 429,
      headers: { "Retry-After": "30" },
    });
  const encoder = new TextEncoder();
  let unsubs: Array<() => void> = [];
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  function cleanup() {
    unsubs.forEach((u) => u());
    unsubs = [];
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    release!();
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        try {
          controller.close();
        } catch {
          // 이미 닫힘
        }
      };
      if (signal.aborted) {
        cleanup();
        return close();
      }
      signal.addEventListener("abort", () => {
        cleanup();
        close();
      });
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // 이미 닫힘 — 무시(정리는 cleanup).
        }
      };
      send(": connected\n\n");
      unsubs = setup(send);
      heartbeat = setInterval(() => send(": ping\n\n"), heartbeatMs);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx 응답 버퍼링 비활성(SSE 즉시 전달)
    },
  });
}
