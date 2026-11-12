import Link from "next/link";

// 사이트 전역 404. 지정하지 않으면 Next 기본 화면(흰 배경·main 없음)이 테마와 어긋나 대비·랜드마크가 깨진다.
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-zinc-500">주소가 바뀌었거나 없는 페이지입니다.</p>
      <nav aria-label="다른 곳으로 이동" className="mt-6">
        <ul className="flex justify-center gap-4 text-sm">
          <li>
            <Link href="/" className="underline">
              홈
            </Link>
          </li>
          <li>
            <Link href="/feed" className="underline">
              피드
            </Link>
          </li>
          <li>
            <Link href="/archive" className="underline">
              아카이브
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
