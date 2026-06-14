export type ThemeChoice = "brand" | "light" | "dark";

// 토글 순환 순서: 대표 → 라이트 → 다크 → 대표.
export const THEME_ORDER: ThemeChoice[] = ["brand", "light", "dark"];

export const THEME_STORAGE_KEY = "theme";

// 기본(대표) 테마 — favicon 색(#0F172A) 기반.
export const DEFAULT_THEME: ThemeChoice = "brand";

// 저장값 정규화(구버전 'system' 등 무효값은 기본 대표 테마로).
export function normalizeTheme(value: string | null): ThemeChoice {
  return value === "light" || value === "dark" || value === "brand"
    ? value
    : DEFAULT_THEME;
}
