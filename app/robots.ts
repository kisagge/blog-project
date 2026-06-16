import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/share";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 관리자·개인/회원 전용 페이지는 색인 제외.
      disallow: [
        "/admin",
        "/account",
        "/login",
        "/signin",
        "/signup",
        "/forgot-password",
        "/notifications",
      ],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
