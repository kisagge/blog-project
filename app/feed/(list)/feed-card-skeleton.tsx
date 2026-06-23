// 무한스크롤 더보기 로딩용 플레이스홀더(장식 — aria-hidden). reduced-motion 존중.
export default function FeedCardSkeleton() {
  return (
    <li
      aria-hidden
      className="flex animate-pulse flex-col gap-3 motion-reduce:animate-none"
    >
      <div className="h-5 w-3/4 rounded bg-black/10 dark:bg-white/10" />
      <div className="h-3 w-full rounded bg-black/[.07] dark:bg-white/[.07]" />
      <div className="h-3 w-5/6 rounded bg-black/[.07] dark:bg-white/[.07]" />
      <div className="h-3 w-32 rounded bg-black/[.05] dark:bg-white/[.05]" />
    </li>
  );
}
