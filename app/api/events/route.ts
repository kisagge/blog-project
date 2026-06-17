import { notificationRecipientId } from "@/lib/notifications";
import { countUnread } from "@/lib/notifications";
import { subscribeUnread } from "@/lib/events";

// SSE: 로그인 회원/관리자에게 알림 미읽음 수를 실시간 전달. 단일 컨테이너 인메모리 버스.
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000; // nginx idle 타임아웃·프록시 버퍼링 회피용 주기 핑

export async function GET(req: Request) {
  const userId = await notificationRecipientId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // 이미 닫힌 컨트롤러 — 무시(정리는 cleanup이 담당).
        }
      };
      const onAbort = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // 이미 닫힘
        }
      };

      // abort 리스너를 await 이전에 등록(초기 쿼리 중 연결이 끊겨도 정리되도록).
      // 이미 끊긴 연결이면 즉시 종료(구독·인터벌 시작 안 함).
      if (req.signal.aborted) {
        try {
          controller.close();
        } catch {
          // 이미 닫힘
        }
        return;
      }
      req.signal.addEventListener("abort", onAbort);

      send(": connected\n\n");
      send(`event: unread\ndata: ${await countUnread(userId)}\n\n`);

      // 초기 쿼리(await) 동안 끊겼을 수 있으니 구독 전에 재확인.
      if (req.signal.aborted) {
        cleanup();
        return;
      }

      unsubscribe = subscribeUnread(userId, (n) => {
        send(`event: unread\ndata: ${n}\n\n`);
      });
      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    unsubscribe?.();
    unsubscribe = undefined;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx 응답 버퍼링 비활성(SSE 즉시 전달)
    },
  });
}
