import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Docker 런너는 pnpm node_modules 전체 + `next start`로 기동하므로 standalone 미사용 */
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
