"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  id: string; // 검증된 11자 영상 id(rehypeEmbeds/parseYouTube)
  start?: number; // 시작 위치(초)
  title?: string; // 링크 텍스트 기반 제목(없으면 일반 명칭)
  href: string; // 원 링크(YouTube에서 보기)
};

// YouTube 임베드 "파사드": 처음엔 썸네일 + 재생 버튼만 렌더하고, 클릭 시에만 개인정보 보호 도메인
// (youtube-nocookie) iframe을 로드 → 페이지 로드 시 플레이어 JS·추적 요청 0, 16:9 상자로 CLS 0.
// 재생 시 버튼이 iframe으로 바뀌므로 포커스를 iframe으로 옮겨 키보드 흐름을 잇는다.
export default function YouTubeEmbed({ id, start, title, href }: Props) {
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const name = title ?? "YouTube 동영상";

  useEffect(() => {
    if (playing) frameRef.current?.focus();
  }, [playing]);

  const params = new URLSearchParams({ autoplay: "1" });
  if (start) params.set("start", String(start));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-video w-full overflow-hidden rounded bg-black">
        {playing ? (
          <iframe
            ref={frameRef}
            src={`https://www.youtube-nocookie.com/embed/${id}?${params}`}
            title={name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`동영상 재생: ${name}`}
            className="group absolute inset-0 h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 flex h-12 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-black/75 text-xl text-white group-hover:bg-red-600"
            >
              ▶
            </span>
          </button>
        )}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start text-sm text-zinc-600 dark:text-zinc-400"
      >
        YouTube에서 보기{title ? `: ${title}` : ""}
      </a>
    </div>
  );
}
