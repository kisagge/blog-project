import { prisma } from "@/lib/prisma";
import { getViewerRole } from "@/lib/dal";
import { checkAccess, type Visibility } from "@/lib/visibility";
import { subscribeComment } from "@/lib/events";

// SSE: 특정 글의 댓글 생성·수정·삭제 이벤트를 실시간 전달. 접근은 글 상세와 동일하게 게이트.
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(req: Request) {
  const feedId = new URL(req.url).searchParams.get("feed");
  if (!feedId) return new Response("Bad Request", { status: 400 });

  const feed = await prisma.feed.findUnique({
    where: { id: feedId },
    select: { visibility: true, status: true, hiddenAt: true },
  });
  if (!feed) return new Response("Not Found", { status: 404 });

  // 글 상세와 동일 게이트: 비관리자는 게시·미숨김·접근 가능한 글만 구독.
  const role = await getViewerRole();
  if (role !== "admin") {
    if (feed.status !== "published" || feed.hiddenAt)
      return new Response("Forbidden", { status: 403 });
    if (checkAccess(feed.visibility as Visibility, role) !== "ok")
      return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

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
      unsubscribe = subscribeComment(feedId, (ev) =>
        send(`data: ${JSON.stringify(ev)}\n\n`),
      );
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
      "X-Accel-Buffering": "no",
    },
  });
}
