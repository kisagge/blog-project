import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import TurnstileWidget from "@/app/turnstile-widget";

describe("TurnstileWidget", () => {
  test("siteKey가 없으면 아무것도 렌더하지 않음(비활성)", () => {
    const { container } = render(<TurnstileWidget />);
    expect(container.querySelector(".cf-turnstile")).toBeNull();
  });

  test("siteKey가 있으면 위젯 div를 sitekey와 함께 렌더", () => {
    const { container } = render(<TurnstileWidget siteKey="site-abc" />);
    const widget = container.querySelector(".cf-turnstile");
    expect(widget).not.toBeNull();
    expect(widget).toHaveAttribute("data-sitekey", "site-abc");
  });
});
