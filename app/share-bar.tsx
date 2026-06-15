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
  "flex h-9 w-9 items-center justify-center rounded-full border border-black/15 hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]";

// 피드·던파 상세 공유 바. X / 카카오톡 / 기기 네이티브 공유(인스타 등) / URL 복사.
export default function ShareBar({
  url,
  title,
  kakaoKey,
  imageUrl,
}: {
  url: string; // 운영 도메인 기준 정규 URL(서버에서 전달)
  title: string;
  kakaoKey?: string;
  imageUrl?: string; // 공유 카드 이미지(절대 URL)
}) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 공유 지원 여부는 브라우저에서만 알 수 있어 마운트 후 확인.
    /* eslint-disable react-hooks/set-state-in-effect */
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
    const link = { mobileWebUrl: url, webUrl: url };
    if (imageUrl) {
      // 이미지가 있으면 카드(feed) 템플릿으로 — 이미지 + 제목 + 버튼.
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: { title, description: title, imageUrl, link },
        buttons: [{ title: "보러가기", link }],
      });
    } else {
      window.Kakao.Share.sendDefault({
        objectType: "text",
        text: title,
        link,
        buttonTitle: "보러가기",
      });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-zinc-500">공유</span>
      <a
        className={btn}
        href={xIntentUrl(url, title)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X에 공유"
        title="X"
      >
        <XIcon />
      </a>
      {kakaoKey && (
        <button
          type="button"
          onClick={shareKakao}
          aria-label="카카오톡으로 공유"
          title="카카오톡"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FEE500] text-[#3C1E1E] hover:opacity-90"
        >
          <KakaoIcon />
        </button>
      )}
      {canShare && (
        <button
          type="button"
          className={btn}
          onClick={() => navigator.share({ title, url }).catch(() => {})}
          aria-label="기기 공유(인스타 등)"
          title="공유"
        >
          <ShareIcon />
        </button>
      )}
      <button
        type="button"
        className={btn}
        onClick={copy}
        aria-label="URL 복사"
        title={copied ? "복사됨" : "URL 복사"}
      >
        {copied ? <CheckIcon /> : <LinkIcon />}
      </button>
    </div>
  );
}

function XIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 3.6c-5 0-9 3.18-9 7.1 0 2.5 1.66 4.7 4.16 5.96-.18.65-.66 2.4-.76 2.77-.12.46.17.46.36.34.15-.1 2.36-1.6 3.32-2.26.62.09 1.26.14 1.92.14 5 0 9-3.18 9-7.1S17 3.6 12 3.6z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
