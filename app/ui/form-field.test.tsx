import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import FormField from "@/app/ui/form-field";

describe("FormField", () => {
  test("label↔입력 연결, 오류 없으면 aria-invalid 없음·안내문만 describedby", () => {
    render(
      <FormField id="f-pw" label="비밀번호" hint="8자 이상">
        {(control) => <input {...control} name="password" type="password" />}
      </FormField>,
    );
    const input = screen.getByLabelText("비밀번호");
    expect(input).toHaveAttribute("id", "f-pw");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("8자 이상");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("오류가 있으면 aria-invalid + 안내문·오류를 함께 설명으로, 오류는 role=alert", () => {
    render(
      <FormField
        id="f-pw"
        label="비밀번호"
        hint="8자 이상"
        error={["너무 짧습니다.", "대문자가 필요합니다."]}
      >
        {(control) => <input {...control} name="password" />}
      </FormField>,
    );
    const input = screen.getByLabelText("비밀번호");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "8자 이상 너무 짧습니다. 대문자가 필요합니다.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "너무 짧습니다. 대문자가 필요합니다.",
    );
  });

  test("빈 오류 배열은 오류 없음으로", () => {
    render(
      <FormField id="f-t" label="제목" error={[]}>
        {(control) => <input {...control} />}
      </FormField>,
    );
    expect(screen.getByLabelText("제목")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
