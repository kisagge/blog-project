import type { Metadata } from "next";
import { getViewerRole } from "@/lib/dal";
import { guardPublicAccess } from "@/lib/site-config";
import MemberGate from "@/app/member-gate";
import GameMount from "./game-mount";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "게임",
  description: "회원 전용 턴제 SRPG — 에테르 택틱스",
};

export default async function PlayPage() {
  await guardPublicAccess(); // 점검 모드: 비어드민 차단
  const role = await getViewerRole();
  if (role === "anon") {
    return (
      <MemberGate
        title="이 게임은 회원만 플레이할 수 있습니다"
        backHref="/feed"
        backLabel="피드"
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        에테르 택틱스
      </h1>
      <p className="mb-6 text-sm text-zinc-500">턴제 그리드 SRPG · 미리보기</p>
      <GameMount />
    </main>
  );
}
