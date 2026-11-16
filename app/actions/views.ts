"use server";
import { trackFeedView, trackDfView, trackSiteVisit } from "@/lib/views";
import { getViewerRole } from "@/lib/dal";
import { getReadableFeed } from "@/lib/feed-access";
import { getClientIp } from "@/lib/client-ip";
import { allowAction } from "@/lib/rate-limit";

// 클라이언트(ViewTracker)가 상세 마운트 시 1회 호출. 봇·프리페치 자연 제외.
// 방문자 쿠키 없이 반복 호출하면 매번 새 방문자로 집계되므로 IP당 한도를 두고,
// 글은 상세와 같은 접근 게이트를 통과한 경우만 센다(비공개·숨김 글 조회수 조작 방지).
export async function trackViewAction(type: "feed" | "df", id: string) {
  if (!allowAction("view", (await getClientIp()) ?? "unknown")) return;
  if (type === "feed") {
    const feed = await getReadableFeed(id, await getViewerRole());
    if (feed) await trackFeedView(feed.id);
  } else if (type === "df") await trackDfView(id);
}

// 모든 페이지(루트 레이아웃)에서 마운트 시 1회 — 일 순 방문자 집계.
export async function trackSiteVisitAction() {
  await trackSiteVisit();
}
