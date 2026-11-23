import { FIELD_ERROR } from "@/lib/ui";

// 입력에 펼쳐 넣을 접근성 속성: label과 같은 id, 오류 표시, 안내문·오류 연결.
export type FieldControlProps = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

// 폼 필드 틀: <label htmlFor> + 입력(children에 control 속성 전달) + 안내문 + 오류(role=alert).
// 입력 요소는 호출부가 그려 type·autoComplete·defaultValue 등을 자유롭게 지정한다.
export default function FormField({
  id,
  label,
  hint,
  error,
  labelClassName = "text-sm font-medium",
  className = "",
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string[];
  labelClassName?: string;
  className?: string; // 틀(div)에 덧붙일 클래스(글자 크기 등)
  children: (control: FieldControlProps) => React.ReactNode;
}) {
  const hasError = !!error && error.length > 0;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, hasError ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1 ${className}`.trim()}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      {children({
        id,
        "aria-invalid": hasError ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-zinc-500">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} role="alert" className={FIELD_ERROR}>
          {error.join(" ")}
        </p>
      )}
    </div>
  );
}
