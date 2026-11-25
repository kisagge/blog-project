import { render, type RenderOptions } from "@testing-library/react";
import { LoginPromptProvider } from "@/app/feed/login-prompt";

// 글 참여 컴포넌트(좋아요·반응·댓글) 렌더: 실제 페이지처럼 로그인 안내 Provider 안에서.
export function renderFeed(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: LoginPromptProvider, ...options });
}
