// 폼/버튼 공용 Tailwind 클래스 상수(서버·클라이언트 공용, server-only 아님).
// 여러 폼에 흩어져 있던 동일 문자열을 한 곳으로 모아 일관성·유지보수성 확보.

// 기본 입력칸(텍스트/이메일/textarea 일부). 추가 modifier는 호출부에서 `${INPUT_CLASS} ...`로.
export const INPUT_CLASS =
  "rounded border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

// 기본(주요) 제출 버튼.
export const PRIMARY_BTN =
  "bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50";

// 네이티브 <dialog> 패널(확인 모달 공용).
export const DIALOG_PANEL =
  "bg-background text-foreground m-auto w-[min(90vw,24rem)] rounded-lg border border-black/15 p-5 shadow-xl backdrop:bg-black/40 dark:border-white/20";
