// SSE(Server-Sent Events) 응답 공용. 알림·피드 이벤트 라우트가 같은 스트림 수명주기를 쓴다:
// 연결 주석 → setup이 초기값 전송·구독 → 주기 핑 → 요청 중단/스트림 취소 시 구독 해제·핑 정지·종료.

const HEARTBEAT_MS = 25_000; // nginx idle 타임아웃·프록시 버퍼링 회피용 주기 핑

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
export function sseResponse(
  signal: AbortSignal,
  setup: (send: (chunk: string) => void) => Array<() => void>,
  { heartbeatMs = HEARTBEAT_MS } = {},
): Response {
  const encoder = new TextEncoder();
  let unsubs: Array<() => void> = [];
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  function cleanup() {
    unsubs.forEach((u) => u());
    unsubs = [];
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
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
      if (signal.aborted) return close();
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
