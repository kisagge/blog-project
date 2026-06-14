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

# 웹 표준 (필수)

새 기능·UI 변경 시 **유효한 마크업과 시맨틱**을 함께 지킨다.

- **중첩 규칙**: 인터랙티브 요소 중첩 금지(`a`/`button` 안에 `a`/`button`), `p` 안에 블록 요소 금지, `form` 중첩 금지, `li`는 `ul/ol` 직속, `table` 구조 준수.
- **시맨틱 요소**: 목적에 맞는 태그(`article/section/nav/header/time/ul/ol/figure`).
- **속성**: 유효한 속성·값만. 불리언/열거 속성 규칙 준수.
- 가능하면 W3C Nu 검사기로 렌더 결과를 확인한다.
- 참고: React 19 server-action 폼은 SSR 시 `action=""`로 렌더되어 검사기가 오류로 표기하나 이는 프레임워크 동작(기능 정상)이며 우리 마크업 결함이 아니다.
