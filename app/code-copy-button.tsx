"use client";

import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

const STATUS: Record<CopyState, string> = {
  idle: "",
  copied: "코드를 복사했습니다",
  failed: "복사하지 못했습니다",
};

// 보이는 문구 / 접근 가능한 이름(보이는 문구를 포함 — label-in-name).
const LABEL: Record<CopyState, [string, string]> = {
  idle: ["복사", "코드 복사"],
  copied: ["복사됨", "코드 복사됨"],
  failed: ["실패", "코드 복사 실패"],
};

// 코드블록 복사 버튼. 원문(code)은 서버에서 hast 텍스트로 추출해 전달 → DOM 탐색 불필요.
// 결과는 버튼 문구 + 스크린리더용 status 영역으로 안내(1.5초 후 원복, share-bar와 동일 리듬).
export default function CodeCopyButton({ code }: { code: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function settle(next: CopyState) {
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1500);
  }

  function copy() {
    if (!navigator.clipboard) return settle("failed"); // 비보안(http) 컨텍스트 등
    navigator.clipboard.writeText(code).then(
      () => settle("copied"),
      () => settle("failed"),
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={LABEL[state][1]}
        className="rounded px-1.5 py-0.5 hover:bg-black/[.06] dark:hover:bg-white/[.1]"
      >
        {LABEL[state][0]}
      </button>
      <span role="status" className="sr-only">
        {STATUS[state]}
      </span>
    </>
  );
}
