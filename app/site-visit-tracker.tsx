"use client";
import { useEffect, useRef } from "react";
import { sendSiteVisitOncePerDay } from "@/app/send-view";

// 루트 레이아웃에 두어 페이지 로드 1회만 방문 집계(클라 내비게이션은 재마운트 없음, 브라우저당 하루 1번 전송).
export default function SiteVisitTracker() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    sendSiteVisitOncePerDay();
  }, []);
  return null;
}
