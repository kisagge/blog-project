import { readAboutRaw } from "@/lib/site-config";
import { kstDateTime } from "@/lib/kst";
import AboutEditor from "./about-editor";

export const metadata = { title: "소개 · 관리자" };

// 런타임 DB 조회.
export const dynamic = "force-dynamic";

// 공개 /about 본문 편집(관리자 레이아웃이 세션 가드). 저장 액션이 다시 verifySession.
export default async function AdminAboutPage() {
  const about = await readAboutRaw();
  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">소개 페이지</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        {about.updatedAt
          ? `공개 중 · 마지막 저장 ${kstDateTime(about.updatedAt)}`
          : "비공개 — 본문을 저장하면 /about 페이지와 메뉴 링크가 열립니다."}
      </p>
      <AboutEditor initial={about.content} />
    </section>
  );
}
