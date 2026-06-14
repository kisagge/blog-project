"use server";
import { trackFeedView, trackDfView, trackSiteVisit } from "@/lib/views";

// 클라이언트(ViewTracker)가 상세 마운트 시 1회 호출. 봇·프리페치 자연 제외.
export async function trackViewAction(type: "feed" | "df", id: string) {
  if (type === "feed") await trackFeedView(id);
  else if (type === "df") await trackDfView(id);
}

// 모든 페이지(루트 레이아웃)에서 마운트 시 1회 — 일 순 방문자 집계.
export async function trackSiteVisitAction() {
  await trackSiteVisit();
}
