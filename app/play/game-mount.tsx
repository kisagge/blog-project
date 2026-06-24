"use client";
// three 씬을 클라이언트에서만 지연 로드(ssr:false). 코드베이스 첫 next/dynamic 사용처.
import dynamic from "next/dynamic";

const SceneCanvas = dynamic(() => import("./scene-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
      보드 불러오는 중…
    </div>
  ),
});

export default function GameMount() {
  return (
    <div>
      <p
        className="mb-3 text-sm text-zinc-500"
        role="status"
        aria-live="polite"
      >
        라운드 1 · 플레이어(여명단) 페이즈 — 정적 미리보기입니다. 유닛 조작은
        다음 업데이트에서 제공됩니다.
      </p>
      <div className="relative h-[60vh] min-h-80 w-full overflow-hidden rounded-lg border border-black/[.08] dark:border-white/[.145]">
        <SceneCanvas />
      </div>
      {/* 스크린리더 보드 요약(S2 베이스라인 — 상호작용 보드 미러는 S3) */}
      <p className="sr-only">
        8×10 격자 전투 보드. 여명단(아군) 4기와 잿더미단(적) 5기가 배치된
        미리보기입니다. 유닛 이동·공격은 다음 업데이트에서 제공됩니다.
      </p>
    </div>
  );
}
