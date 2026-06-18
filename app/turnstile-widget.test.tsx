import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import TurnstileWidget from "@/app/turnstile-widget";

describe("TurnstileWidget", () => {
  test("siteKey가 없으면 아무것도 렌더하지 않음(비활성)", () => {
    const { container } = render(<TurnstileWidget />);
    expect(container.querySelector('[data-testid="turnstile"]')).toBeNull();
  });

  test("siteKey가 있으면 위젯 컨테이너를 렌더(런타임에 명시 render)", () => {
    const { container } = render(<TurnstileWidget siteKey="site-abc" />);
    expect(container.querySelector('[data-testid="turnstile"]')).not.toBeNull();
  });

  test("resetSignal에 에러가 있어도(위젯 미로드) throw하지 않음", () => {
    // window.turnstile 미정의 상태에서 reset이 호출돼도 try/catch로 안전.
    expect(() =>
      render(
        <TurnstileWidget siteKey="site-abc" resetSignal={{ error: "x" }} />,
      ),
    ).not.toThrow();
  });
});
