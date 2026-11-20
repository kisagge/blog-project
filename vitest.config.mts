import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    // 서버 전용 표시 모듈은 테스트에선 빈 모듈 — 파일마다 vi.mock("server-only")를 둘 필요 없음.
    alias: {
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // 실제 마이그레이션으로 테스트 DB 템플릿을 1회 생성(lib/test-db.ts가 파일마다 복사).
    globalSetup: ["./vitest.global-setup.ts"],
    // 일부 테스트는 실제 scrypt 해싱 + 임시 SQLite를 사용해 느린 러너에서 5s 기본
    // 타임아웃을 넘길 수 있어 여유를 둔다(flaky 방지).
    testTimeout: 20000,
  },
});
