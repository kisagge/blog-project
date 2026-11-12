import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/jwt";
import { rateLimit, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import { clientIpFromXff } from "@/lib/forwarded-ip";
import { RATE_LIMITS, rateBucket, requestKind } from "@/lib/request-kind";

// 문서 요청이 429일 때 보여 줄 최소 HTML(언어·제목·본문 랜드마크 포함 — 평문 응답은 lang·title 없는 빈 화면).
const TOO_MANY_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>잠시 후 다시 시도해 주세요</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.6;color:#171717;background:#fff"><main><h1 style="font-size:1.25rem">요청이 너무 많습니다</h1><p>잠시 후 다시 시도해 주세요. 10초쯤 기다린 뒤 새로고침하면 됩니다.</p></main></body></html>`;

// 전반적 요청 어뷰징 방지: IP당 10초 윈도우 요청 수 제한(정적 자산은 matcher에서 제외).
// 링크 프리페치·앱 내 이동(RSC)은 페이지마다 수십 건이라 별도 버킷으로 센다(lib/request-kind).
export async function proxy(req: NextRequest) {
  const ip = clientIpFromXff(req.headers.get("x-forwarded-for")) ?? "unknown";
  const kind = requestKind(req.method, req.nextUrl.pathname, req.headers);
  const bucket = rateBucket(kind);
  const { limit, windowMs } = RATE_LIMITS[bucket];
  if (!rateLimit(`${bucket}:${ip}`, limit, windowMs)) {
    const headers = { "Retry-After": "10" };
    return kind === "document"
      ? new NextResponse(TOO_MANY_HTML, {
          status: 429,
          headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
        })
      : new NextResponse(TOO_MANY_REQUESTS, { status: 429, headers });
  }

  // 관리자 경로 가드.
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const session = await decrypt(req.cookies.get("session")?.value);
    if (session?.role !== "admin") {
      return NextResponse.redirect(new URL("/login", req.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  // 정적 자산·이미지·업로드는 제외하고 동적 요청에만 적용.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|apple-icon|sw.js|manifest|uploads/|api/health(?:/|$)).*)",
  ],
};
