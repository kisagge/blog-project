# 변경 이력

이 프로젝트의 주요 변경을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/)를 따르며, 버전은 [유의적 버전](https://semver.org/lang/ko/)(pre-1.0: feat=minor, fix/chore=patch)을 사용합니다. 세부 커밋 이력은 git 로그를 참고하세요.

## [0.54.1]

### Changed
- 리팩토링: 공용 UI 클래스 상수(`lib/ui.ts`)·클라이언트 IP 헬퍼(`lib/client-ip.ts`)·`useTurnstileReset` 훅·`SimpleFormState`·공용 `ConfirmDialog`로 폼/모달 중복 제거(동작 불변).

### Performance
- `View`에 `[entityType, day]` 인덱스 추가 — 일별 방문자 카운트(관리자 대시보드) 인덱스 적용.

## [0.54.0]

### Added
- 로그인 CAPTCHA: 가입·로그인·비밀번호 재설정 요청에 **Cloudflare Turnstile**(무료). 키 미설정 시 완전 비활성.
- 비밀번호 코드 **재발송 쿨다운**(메일 폭탄 방지).

## [0.53.0]

### Added
- 회원 글쓰기 **작성/미리보기 탭** + 접이식 **마크다운 도움말**. 게시 화면과 동일 렌더러 공유(`MarkdownContent`).

## [0.52.0]

### Added
- 콘텐츠 **모더레이션**: 관리자 신고 큐(`/admin/reports`)에서 숨김(복구 가능)·기각. 숨김 콘텐츠는 목록·프로필·상세·RSS·사이트맵·OG 모든 소비처에서 제외, 관리자만 검토 열람.

## [0.51.0]

### Added
- 콘텐츠 **신고** 적재: 회원이 댓글·회원 글을 사유와 함께 신고 → 예약 관리자 알림(첫 신고 1회).

## [0.50.0]

### Added
- 회원 **공개 프로필**(`/u/[id]`, `/me`): 작성 글·최근 댓글. 글·댓글·피드 카드 작성자 닉네임에서 프로필 링크(회원 한정).

## 0.1.0 – 0.49.x — 초기 구축

기반과 커뮤니티 기능을 단계적으로 구축(세부는 git 이력):

- **인프라/배포**: Docker 멀티스테이지 이미지(2.05GB→876MB), GHCR + Lightsail SSH 배포, `prisma migrate deploy`, 컨테이너 이미지·디스크·OOM 안정화.
- **데이터/런타임**: Prisma 7 드라이버 어댑터(better-sqlite3), 앱 레이어 유니온 타입(가시성·상태·역할).
- **공개 피드**: 목록·상세(마크다운), 검색 + 무한스크롤, 조회수, **공개 범위 3단계**(전체/회원/비공개) 공용 접근 제어.
- **던파 쇼케이스**: Neople OpenAPI 캐릭터 정보, 관리자 등록·드래그 정렬.
- **회원 시스템**: 가입 신청 → 승인 흐름(거절·재신청·차단), JWT 유니온 세션, 비밀번호 재설정(이메일 6자리 코드), 관리자 TOTP 2FA.
- **커뮤니티**: 2뎁스 댓글·좋아요(예약 관리자 User), 회원 글 작성(임시저장→회원공개), 인앱 알림 + 웹 푸시(PWA).
- **탐색·SEO**: 글 태그 + 태그별 필터, 읽는 시간·목차(TOC), RSS 피드, 동적 OG 이미지, sitemap·robots.
- **운영**: 본문 이미지 업로드, 점검 모드, IP 전역 속도 제한.

[0.54.1]: https://github.com/kisagge/blog-project/releases/tag/v0.54.1
[0.54.0]: https://github.com/kisagge/blog-project/releases/tag/v0.54.0
[0.53.0]: https://github.com/kisagge/blog-project/releases/tag/v0.53.0
[0.52.0]: https://github.com/kisagge/blog-project/releases/tag/v0.52.0
[0.51.0]: https://github.com/kisagge/blog-project/releases/tag/v0.51.0
[0.50.0]: https://github.com/kisagge/blog-project/releases/tag/v0.50.0
