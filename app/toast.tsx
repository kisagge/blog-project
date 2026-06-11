"use client";
import { useCallback, useRef, useState } from "react";

export type ToastKind = "error" | "success";
export type Toast = { id: number; message: string; kind: ToastKind };

/** 화면 우하단에 잠시 떴다 자동으로 사라지는 토스트. 의존성 없는 자체 구현. */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = "error") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return { toasts, show };
}

export function ToastViewport({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`animate-toast-in pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
            t.kind === "error" ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
