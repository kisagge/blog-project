// Next 서버 부팅 시 1회 실행(런타임별). 예약 발행을 앱 내부 인터벌로 돌려
// 외부 cron(GitHub/호스트)·CRON_SECRET 없이 정시 발행하게 한다.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // edge 런타임 제외
  const { startPublishScheduler } = await import("@/lib/scheduled");
  startPublishScheduler();
}
