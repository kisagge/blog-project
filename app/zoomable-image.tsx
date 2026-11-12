"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  src: string;
  alt: string;
  title?: string; // 문장 속 이미지의 툴팁(캡션으로 옮겨진 경우엔 없음)
  width?: number;
  height?: number;
};

// 본문 이미지 확대(라이트박스). 네이티브 <dialog>.showModal()이 포커스 이동·트랩, 바깥 inert,
// Esc 닫기, 닫힐 때 트리거(버튼)로 포커스 복귀를 처리(ConfirmDialog와 같은 패턴). 백드롭 클릭으로도 닫힘.
// 이미지는 문단(p) 안에 올 수 있는데 dialog는 p의 자식이 될 수 없어, 열릴 때만 body로 포털 렌더
// (본문 마크업 유효성 유지 + 큰 이미지는 열 때만 로드). 애니메이션이 없어 동작 줄이기 선호와 무관하게 안전.
export default function ZoomableImage({
  src,
  alt,
  title,
  width,
  height,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={alt ? `이미지 크게 보기: ${alt}` : "이미지 크게 보기"}
        className="max-w-full cursor-zoom-in rounded"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          title={title}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
        />
      </button>
      {open &&
        createPortal(
          <dialog
            ref={ref}
            aria-label={alt || "확대 이미지"}
            onClose={() => setOpen(false)}
            // 패널 바깥(백드롭) 클릭 = dialog 자신이 target일 때만 닫기.
            onClick={(e) =>
              e.target === e.currentTarget && ref.current?.close()
            }
            className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/85"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="block max-h-[90vh] max-w-[95vw] object-contain"
            />
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="닫기"
              className="absolute top-2 right-2 rounded-full bg-black/70 px-3 py-1.5 text-sm text-white hover:bg-black/90"
            >
              ✕
            </button>
          </dialog>,
          document.body,
        )}
    </>
  );
}
