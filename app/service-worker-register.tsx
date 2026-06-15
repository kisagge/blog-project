"use client";
import { useEffect } from "react";

// PWA 서비스 워커 등록(설치·오프라인). 루트 레이아웃에서 1회.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
