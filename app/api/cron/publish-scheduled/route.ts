import { timingSafeEqual } from "crypto";
import { publishDueFeeds } from "@/lib/scheduled";

export const dynamic = "force-dynamic";

// 상수시간 문자열 비교(길이 노출 없이 불일치=false).
function secretMatches(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// 예약 발행 cron 엔드포인트. GitHub Actions가 호스트에서 localhost로 POST(시크릿 헤더).
// CRON_SECRET 미설정/불일치 → 401(미설정 시 사실상 비활성).
export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-cron-secret"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const published = await publishDueFeeds();
  return Response.json({ published });
}
