export type ThemeChoice = "light" | "dark" | "system";

// 토글 순환 순서.
export const THEME_ORDER: ThemeChoice[] = ["light", "dark", "system"];

export const THEME_STORAGE_KEY = "theme";

// 선택 + OS 선호를 실제 적용 테마(light|dark)로 해석.
export function resolveTheme(
  choice: ThemeChoice,
  prefersDark: boolean,
): "light" | "dark" {
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}
