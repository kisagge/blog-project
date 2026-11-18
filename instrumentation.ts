import type { Instrumentation } from "next";

// Next 서버 부팅 시 1회 실행(런타임별). 예약 발행을 앱 내부 인터벌로 돌려
// 외부 cron(GitHub/호스트)·CRON_SECRET 없이 정시 발행하게 한다.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // edge 런타임 제외
  const { startPublishScheduler } = await import("@/lib/scheduled");
  startPublishScheduler();
}

// 서버 오류 요청 맥락. next start는 오류 스택·digest를 이미 컨테이너 로그에 찍지만 어느 요청에서
// 났는지는 남기지 않는다 → 메서드·경로·라우트·digest를 한 줄로 덧붙여 화면에 보인 digest와 대조한다.
// 경로의 쿼리는 버린다(토큰 등 민감값이 로그에 남지 않게). 스택은 Next 출력과 중복이라 생략.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String(err.digest)
      : "-";
  const path = request.path.split("?")[0];
  console.error(
    `[request-error] ${request.method} ${path} route=${context.routePath} type=${context.routeType} digest=${digest}`,
  );
};
