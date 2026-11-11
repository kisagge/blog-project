"use client";
import { useEffect } from "react";
import { readDepth } from "@/lib/read-depth";

const TICK_MS = 5_000; // 활성 시간 적립 단위
const IDLE_MS = 30_000; // 마지막 상호작용 후 이 시간이 지나면 "자리 비움"으로 보고 적립 중단
const MAX_BEACON_SECONDS = 600; // 서버 스키마 상한과 일치(비콘 1회 증분)
const FLUSH_EVERY_SECONDS = 30; // 페이지가 살아 있는 동안에도 주기 전송(언로드 순간 비콘 유실 대비)

// 글 읽기 지표(익명): 본문을 읽은 최대 깊이 + 탭이 보이고 상호작용 중이던 시간을 모아,
// 페이지가 가려지거나(탭 전환·앱 전환) 떠날 때 sendBeacon으로 /api/read에 보낸다.
// 언로드 순간의 비콘은 환경에 따라 유실될 수 있어, 활성 시간이 30초 쌓일 때마다도 보낸다(유실 상한 30초).
// 조회 트래킹(ViewTracker)이 만든 오늘의 View 행에만 덧붙으며, UI는 렌더하지 않는다.
export default function ReadTracker({ feedId }: { feedId: string }) {
  useEffect(() => {
    const article = document.querySelector("main article");
    if (!article) return;

    let depth = 0;
    let sentDepth = 0;
    let pendingSeconds = 0;
    let lastActive = Date.now();
    let raf = 0;

    const measure = () => {
      raf = 0;
      const r = article.getBoundingClientRect();
      depth = Math.max(depth, readDepth(r.top, r.height, window.innerHeight));
    };
    const onActivity = () => {
      lastActive = Date.now();
    };
    const onScroll = () => {
      onActivity();
      if (!raf) raf = requestAnimationFrame(measure);
    };
    const flush = () => {
      if (pendingSeconds === 0 && depth <= sentDepth) return;
      const seconds = Math.min(pendingSeconds, MAX_BEACON_SECONDS);
      const body = JSON.stringify({ feedId, depth, seconds });
      if (navigator.sendBeacon?.("/api/read", body)) {
        pendingSeconds -= seconds;
        sentDepth = depth;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else onActivity();
    };

    measure();
    const tick = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastActive < IDLE_MS
      ) {
        pendingSeconds += TICK_MS / 1000;
        if (pendingSeconds >= FLUSH_EVERY_SECONDS) flush();
      }
    }, TICK_MS);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("pointermove", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      flush(); // 클라이언트 내비게이션으로 떠날 때
      window.clearInterval(tick);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("pointermove", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [feedId]);

  return null;
}
