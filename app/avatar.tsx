// 프로필 아바타: 이미지가 있으면 원형 표시, 없으면 닉네임 이니셜 플레이스홀더.
// 서버·클라 공용 순수 표현 컴포넌트.
export default function Avatar({
  src,
  nickname,
  size = 80,
}: {
  src?: string | null;
  nickname: string;
  size?: number;
}) {
  const initial = nickname.trim().charAt(0) || "?";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${nickname} 님의 프로필 이미지`}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-black/[.08] font-semibold text-zinc-500 dark:bg-white/[.12] dark:text-zinc-400"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </span>
  );
}
