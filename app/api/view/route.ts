import { z } from "zod";
import { trackDfView, trackFeedView, trackSiteVisit } from "@/lib/views";
import { getViewerRole } from "@/lib/dal";
import { getReadableFeed } from "@/lib/feed-access";
import { clientIpKey } from "@/lib/form-guard";
import { allowAction } from "@/lib/rate-limit";

// 조회·방문 기록 수신(ViewTracker·SiteVisitTracker의 fetch keepalive).
// 서버 액션이 아니라 Route Handler인 이유: 첫 방문 때 방문자 쿠키(vid)를 발급하는데, 서버 액션에서
// 쿠키를 쓰면 Next가 현재 페이지와 레이아웃을 다시 렌더해 응답한다(첫 방문마다 페이지 전체 2회 렌더).
// 모든 기록에 IP당 한도 — 쿠키 없이 반복 호출하면 매번 새 방문자가 되므로(사이트 방문 포함).
const ViewBeacon = z.discriminatedUnion("type", [
  z.object({ type: z.literal("site") }),
  z.object({ type: z.literal("feed"), id: z.string().min(1).max(64) }),
  z.object({ type: z.literal("df"), id: z.string().min(1).max(64) }),
]);

export async function POST(req: Request) {
  if (!allowAction("view", await clientIpKey()))
    return new Response(null, { status: 429 });
  let parsed;
  try {
    parsed = ViewBeacon.safeParse(JSON.parse(await req.text()));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed.success) return new Response(null, { status: 400 });

  const v = parsed.data;
  if (v.type === "site") await trackSiteVisit();
  else if (v.type === "df") await trackDfView(v.id);
  else {
    // 글은 상세와 같은 접근 게이트를 통과한 경우만(비공개·숨김 글 조회수 조작 방지).
    const feed = await getReadableFeed(v.id, await getViewerRole());
    if (feed) await trackFeedView(feed.id);
  }
  return new Response(null, { status: 204 });
}
