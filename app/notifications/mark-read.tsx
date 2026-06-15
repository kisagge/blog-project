"use client";
import { useEffect, useRef } from "react";
import { markNotificationsReadAction } from "@/app/actions/notifications";

// 알림 페이지 진입 시 1회 모두 읽음 처리(헤더 배지 갱신).
export default function MarkRead() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markNotificationsReadAction();
  }, []);
  return null;
}
