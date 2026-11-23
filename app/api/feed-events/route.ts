import { prisma } from "@/lib/prisma";
import { getViewerRole } from "@/lib/dal";
import { canReadFeed } from "@/lib/feed-access";
import { subscribeFeed } from "@/lib/events";
import { sseEvent, sseResponse } from "@/lib/sse";

// SSE: 특정 글의 피드 이벤트(댓글 생성·수정·삭제·좋아요·리액션 + 글 좋아요·리액션)를 실시간 전달.
// 접근은 글 상세와 동일하게 게이트.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const feedId = new URL(req.url).searchParams.get("feed");
  if (!feedId) return new Response("Bad Request", { status: 400 });

  const feed = await prisma.feed.findUnique({
    where: { id: feedId },
    select: { visibility: true, status: true, hiddenAt: true },
  });
  if (!feed) return new Response("Not Found", { status: 404 });

  // 글 상세·댓글 액션과 같은 게이트(lib/feed-access): 비관리자는 게시·미숨김·접근 가능한 글만 구독.
  if (!canReadFeed(feed, await getViewerRole()))
    return new Response("Forbidden", { status: 403 });

  return sseResponse(req.signal, (send) => [
    subscribeFeed(feedId, (ev) => send(sseEvent(ev))),
  ]);
}
