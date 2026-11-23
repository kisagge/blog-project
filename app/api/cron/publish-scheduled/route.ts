import { safeEqual } from "@/lib/safe-equal";
import { publishDueFeeds } from "@/lib/scheduled";

export const dynamic = "force-dynamic";

// 시크릿 헤더 확인. 미설정(빈 값)이면 항상 거부 — 빈 값끼리 일치로 통과하지 않게.
function secretMatches(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected || !provided) return false;
  return safeEqual(provided, expected);
}

// 예약 발행 cron 엔드포인트(보조 경로). 평소엔 앱 내부 스케줄러(instrumentation → lib/scheduled)가 발행하고,
// 이 엔드포인트는 수동 워크플로(publish-scheduled.yml)가 호스트에서 localhost로 POST할 때 쓴다(시크릿 헤더).
// CRON_SECRET 미설정/불일치 → 401(미설정 시 사실상 비활성).
export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-cron-secret"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const published = await publishDueFeeds();
  return Response.json({ published });
}
