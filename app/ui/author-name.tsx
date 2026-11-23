import Link from "next/link";

// 작성자 표시 공용: 회원(id 있음)이고 링크 허용(link)이면 공개 프로필 링크, 아니면 텍스트.
// 링크 허용 여부는 호출부가 결정(비로그인에겐 프로필이 회원 전용이라 링크를 숨김).
export default function AuthorName({
  id,
  name,
  link,
  className = "",
}: {
  id: string | null | undefined;
  name: string;
  link: boolean;
  className?: string;
}) {
  return id && link ? (
    <Link href={`/u/${id}`} className={`${className} hover:underline`.trim()}>
      {name}
    </Link>
  ) : (
    <span className={className || undefined}>{name}</span>
  );
}
