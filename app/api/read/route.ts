import { cookies } from "next/headers";
import { ReadBeaconSchema, recordRead } from "@/lib/read-metrics";

// 글 읽기 지표 비콘 수신(ReadTracker의 navigator.sendBeacon). 응답 본문은 쓰지 않으므로 항상 204/400.
// - 방문자 쿠키(vid)는 조회 트래킹이 발급한 것만 사용하고 여기서 새로 만들지 않는다.
// - vid는 SameSite=Lax라 타 사이트발 POST엔 실리지 않아, 외부에서 남의 지표를 조작할 수 없다.
// - 본문은 text/plain(JSON 문자열) — sendBeacon이 preflight 없이 보내도록.
export async function POST(req: Request) {
  const visitorId = (await cookies()).get("vid")?.value;
  if (!visitorId) return new Response(null, { status: 204 });

  let parsed;
  try {
    parsed = ReadBeaconSchema.safeParse(JSON.parse(await req.text()));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed.success) return new Response(null, { status: 400 });

  await recordRead(visitorId, parsed.data);
  return new Response(null, { status: 204 });
}
