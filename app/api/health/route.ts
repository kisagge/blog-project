import { prisma } from "@/lib/prisma";

// 컨테이너 헬스체크용. DB 핑까지 확인해 "응답은 살아있되 DB가 죽은" 행 상태를 감지.
// 인증·캐시 없음. 상태 문자열만 반환(내부 정보 미노출).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok" });
  } catch {
    return Response.json({ status: "error", db: "down" }, { status: 503 });
  }
}
