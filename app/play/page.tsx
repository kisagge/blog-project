import { getMemberSession, getSession } from "@/lib/dal";
import MemberGate from "@/app/member-gate";
import Game from "./game";
import Leaderboard from "./leaderboard";

export const metadata = {
  title: "심연 강하",
  description:
    "회원 전용 로그라이크 텍스트 RPG — 시드 하나로 얼마나 깊이 내려가나.",
};
// 매 방문마다 새 시드. 회원 세션 확인을 위해 동적 렌더.
export const dynamic = "force-dynamic";

export default async function PlayPage() {
  // 승인 회원 + 관리자 모두 플레이 가능(관리자 세션은 getMemberSession이 null).
  const session = await getSession();
  const member = await getMemberSession();
  const allowed = session?.role === "admin" || member;
  if (!allowed) {
    return (
      <MemberGate
        title="회원 전용 게임입니다"
        backHref="/community"
        backLabel="커뮤니티"
      />
    );
  }

  // 시드는 클라이언트 마운트 시 생성(서버 랜덤 = 비순수·하이드레이션 불일치 회피).
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">심연 강하</h1>
        <p className="mt-1 text-sm text-zinc-500">
          한 걸음씩 내려가며 조우를 헤쳐 최대한 깊이 도달하세요. 죽으면
          처음부터.
        </p>
      </header>
      <Game canRecord={!!member} />
      <Leaderboard highlightUserId={member ? member.userId : undefined} />
    </main>
  );
}
