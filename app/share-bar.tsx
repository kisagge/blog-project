"use client";
import { useEffect, useState } from "react";
import { xIntentUrl } from "@/lib/share";

type KakaoSDK = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: { sendDefault: (o: unknown) => void };
};
declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}

const btn =
  "rounded-full border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]";

// 피드·던파 상세 공유 바. X / 카카오톡 / 기기 네이티브 공유(인스타 등) / URL 복사.
export default function ShareBar({
  title,
  kakaoKey,
}: {
  title: string;
  kakaoKey?: string;
}) {
  const [url, setUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 브라우저에서만 가능한 값(현재 URL·공유 지원 여부)을 마운트 후 읽는다.
    /* eslint-disable react-hooks/set-state-in-effect */
    setUrl(window.location.href);
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Kakao SDK 로드 + 초기화(키 있을 때만).
  useEffect(() => {
    if (!kakaoKey) return;
    const ID = "kakao-sdk";
    const init = () => {
      if (window.Kakao && !window.Kakao.isInitialized())
        window.Kakao.init(kakaoKey);
    };
    if (window.Kakao) {
      init();
      return;
    }
    const existing = document.getElementById(ID);
    if (existing) {
      existing.addEventListener("load", init);
      return;
    }
    const s = document.createElement("script");
    s.id = ID;
    s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    s.crossOrigin = "anonymous";
    s.addEventListener("load", init);
    document.head.appendChild(s);
  }, [kakaoKey]);

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function shareKakao() {
    if (!window.Kakao?.isInitialized()) return;
    window.Kakao.Share.sendDefault({
      objectType: "text",
      text: title,
      link: { mobileWebUrl: url, webUrl: url },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-zinc-500">공유</span>
      <a
        className={btn}
        href={xIntentUrl(url, title)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X에 공유"
      >
        X
      </a>
      {kakaoKey && (
        <button
          type="button"
          className={btn}
          onClick={shareKakao}
          aria-label="카카오톡으로 공유"
        >
          카카오톡
        </button>
      )}
      {canShare && (
        <button
          type="button"
          className={btn}
          onClick={() => navigator.share({ title, url }).catch(() => {})}
          aria-label="기기 공유(인스타 등)"
        >
          공유
        </button>
      )}
      <button
        type="button"
        className={btn}
        onClick={copy}
        aria-label="URL 복사"
      >
        {copied ? "복사됨!" : "URL 복사"}
      </button>
    </div>
  );
}
