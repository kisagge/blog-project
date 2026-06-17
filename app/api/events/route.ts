import { notificationRecipientId, countUnread } from "@/lib/notifications";
import { getSession } from "@/lib/dal";
import { subscribeUnread, subscribeReports } from "@/lib/events";
import { countPendingReportTargets } from "@/lib/reports";

// SSE: 로그인 회원/관리자에게 알림 미읽음 수(+관리자는 미처리 신고 수)를 실시간 전달.
// 단일 컨테이너 인메모리 버스.
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000; // nginx idle 타임아웃·프록시 버퍼링 회피용 주기 핑

export async function GET(req: Request) {
  const userId = await notificationRecipientId();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  // 초기값은 스트림 생성 전에 조회(start를 동기로 유지 → await-window 누수 없음).
  const isAdmin = (await getSession())?.role === "admin";
  const initialUnread = await countUnread(userId);
  const initialReports = isAdmin ? await countPendingReportTargets() : 0;

  const encoder = new TextEncoder();
  const unsubs: Array<() => void> = [];
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  function cleanup() {
    unsubs.forEach((u) => u());
    unsubs.length = 0;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // 이미 닫힘 — 무시(정리는 cleanup).
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
      send(`event: unread\ndata: ${initialUnread}\n\n`);
      unsubs.push(
        subscribeUnread(userId, (n) => send(`event: unread\ndata: ${n}\n\n`)),
      );

      // 관리자는 미처리 신고 수도 구독(같은 연결에 이벤트 종류만 추가).
      if (isAdmin) {
        send(`event: reports\ndata: ${initialReports}\n\n`);
        unsubs.push(
          subscribeReports((c) => send(`event: reports\ndata: ${c}\n\n`)),
        );
      }
      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
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
