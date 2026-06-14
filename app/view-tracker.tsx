"use client";
import { useEffect, useRef } from "react";
import { trackViewAction } from "@/app/actions/views";

// 상세 페이지 마운트 시 1회만 조회 트래킹(StrictMode 중복 호출은 ref로 가드).
export default function ViewTracker({
  type,
  id,
}: {
  type: "feed" | "df";
  id: string;
}) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void trackViewAction(type, id);
  }, [type, id]);
  return null;
}
