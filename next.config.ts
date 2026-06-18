import type { NextConfig } from "next";
// 상대경로 import: next.config는 tsconfig `@/` 별칭을 적용하지 않는다.
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  /* Docker 런너는 pnpm node_modules 전체 + `next start`로 기동하므로 standalone 미사용 */
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    // 모든 경로에 보안 헤더 적용(정적 자산 포함 — 무해).
    return [{ source: "/(.*)", headers: securityHeaders() }];
  },
};

export default nextConfig;
