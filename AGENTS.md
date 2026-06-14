<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# 웹 접근성 (필수)

새 기능 추가나 UI 변경 시 **항상 접근성을 함께 반영**한다(별도 요청 없어도 기본 포함).

- **시맨틱·랜드마크**: 적절한 `main/nav/header`, 제목 위계(h1→h2…), 목록은 `ul/ol`.
- **이미지**: 의미 있는 이미지에 `alt`, 장식용은 `alt=""`.
- **폼**: `label`을 `htmlFor/id`로 연결, 에러 메시지에 `role="alert"`, 잘못된 입력에 `aria-invalid`/`aria-describedby`.
- **아이콘 전용 버튼/링크**: `aria-label` 필수. 토글은 `aria-expanded`/`aria-pressed`.
- **키보드**: 모든 인터랙션 키보드 가능. 모달/드로어는 포커스 이동·트랩·복귀, 닫기는 `Esc`, 닫혔을 땐 `inert`.
- **실시간 영역**: 토스트·상태 변화는 `aria-live`(`role="status|alert"`).
- **모션**: `prefers-reduced-motion` 존중.
- **대비**: 텍스트/배경 색 대비 충분히(특히 보조 텍스트).

새 컴포넌트엔 위 항목을 점검하고, 가능한 경우 테스트에도 반영한다.
