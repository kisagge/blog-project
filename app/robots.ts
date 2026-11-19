import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/share";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 관리자·개인/회원 전용 페이지와 색인할 내용이 없는 경로는 크롤링 제외.
      // 회원 게이트 페이지(/u/, /following, /community, 회원공개 글)는 여기서 막지 않고 메타데이터 noindex로 —
      // robots.txt로 막으면 크롤러가 noindex를 못 읽어 URL만 색인될 수 있다.
      disallow: [
        "/admin",
        "/account",
        "/login",
        "/signin",
        "/signup",
        "/forgot-password",
        "/notifications",
        "/me", // 내 프로필 바로가기(리다이렉트)
        "/maintenance", // 점검 안내
        "/offline.html", // 서비스 워커 오프라인 안내
        "/api/", // 헬스·SSE·비콘 등 API
      ],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
