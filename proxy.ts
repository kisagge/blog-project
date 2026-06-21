import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/jwt";
import { rateLimit } from "@/lib/rate-limit";

// 전반적 요청 어뷰징 방지: IP당 윈도우 내 요청 수 제한(정적 자산은 matcher에서 제외).
const REQ_LIMIT = 120;
const REQ_WINDOW_MS = 10_000;

export async function proxy(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`req:${ip}`, REQ_LIMIT, REQ_WINDOW_MS)) {
    return new NextResponse(
      "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      {
        status: 429,
        headers: { "Retry-After": "10" },
      },
    );
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
    "/((?!_next/static|_next/image|favicon.ico|icons/|apple-icon|sw.js|manifest|uploads/|api/health).*)",
  ],
};
