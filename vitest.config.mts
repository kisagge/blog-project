import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // 일부 테스트는 실제 scrypt 해싱 + 임시 SQLite를 사용해 느린 러너에서 5s 기본
    // 타임아웃을 넘길 수 있어 여유를 둔다(flaky 방지).
    testTimeout: 20000,
  },
});
