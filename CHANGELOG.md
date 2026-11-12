# 변경 이력

이 프로젝트의 주요 변경을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/)를 따르며, 버전은 [유의적 버전](https://semver.org/lang/ko/)(pre-1.0: feat=minor, fix/chore=patch)을 사용합니다. 세부 커밋 이력은 git 로그를 참고하세요. 0.55.0 이후 항목의 링크는 해당 변경의 PR입니다.

## [0.110.1] - 2026-11-12

### Security

- 클라이언트 IP를 `X-Forwarded-For` 마지막 항목(nginx가 덧붙인 실제 주소)으로 판별 — 첫 항목 위조로 모든 IP 요청 제한을 우회하던 문제 수정, 버킷 상한 초과 시 전체 초기화 대신 오래된 키만 정리

## [0.110.0] - 2026-11-12

### Added

- DB 오프사이트 백업 — 매일 백업을 age 공개키로 암호화해 GitHub 아티팩트(90일)로 보관, 복원 절차 문서화 ([#219](https://github.com/kisagge/blog-project/pull/219))

## [0.109.3] - 2026-11-12

### Fixed

- 문장 속 이미지가 기준선 위로 뜨거나 줄이 끊기던 배치 수정 ([#217](https://github.com/kisagge/blog-project/pull/217))

## [0.109.2] - 2026-11-12

### Fixed

- 링크 프리페치를 별도 레이트 리밋 버킷으로 — 빠른 탐색·관리자 탭 429 해소 ([#216](https://github.com/kisagge/blog-project/pull/216))

## [0.109.1] - 2026-11-12

### Fixed

- axe 자동 점검 위반 일괄 보정 — 대비·라벨·404·제목 ([#215](https://github.com/kisagge/blog-project/pull/215))

## [0.109.0] - 2026-11-11

### Added

- 글 수정 이력 — 리비전 보관·줄 단위 비교·되돌리기 ([#214](https://github.com/kisagge/blog-project/pull/214))

## [0.108.0] - 2026-11-11

### Added

- 본문 수식(KaTeX)·다이어그램(Mermaid) ([#213](https://github.com/kisagge/blog-project/pull/213))

## [0.107.0] - 2026-11-11

### Added

- 글별 읽기 지표 — 완독률·평균 읽은 시간 ([#211](https://github.com/kisagge/blog-project/pull/211))

## [0.106.0] - 2026-11-10

### Added

- 본문 YouTube 임베드 — 클릭 시 로드하는 파사드 ([#210](https://github.com/kisagge/blog-project/pull/210))

## [0.105.0] - 2026-11-10

### Added

- 본문 이미지 클릭 확대(라이트박스) + 캡션 ([#209](https://github.com/kisagge/blog-project/pull/209))

## [0.104.0] - 2026-11-10

### Added

- 관리자 편집 소개 페이지 /about ([#208](https://github.com/kisagge/blog-project/pull/208))

## [0.103.0] - 2026-11-10

### Added

- 수정일·RSS 전문·아카이브·llms.txt ([#207](https://github.com/kisagge/blog-project/pull/207))

## [0.102.0] - 2026-11-10

### Added

- 본문 렌더 보강 — 코드 복사·헤딩 앵커·콜아웃·목록/인용/각주 ([#206](https://github.com/kisagge/blog-project/pull/206))

## [0.101.0] - 2026-06-29 ~ 2026-11-10

> 버전을 올리지 않은 의존성·CI 변경이 이 버전 이름으로 이어서 배포됨.

### Changed

- Bump actions/setup-node from 6 to 7 ([#194](https://github.com/kisagge/blog-project/pull/194))
- pnpm audit 게이트를 critical → moderate로 강화 ([#204](https://github.com/kisagge/blog-project/pull/204))

### Security

- minor-and-patch 20개 업데이트 + next 16.4.5(critical RCE 해소) ([#201](https://github.com/kisagge/blog-project/pull/201))
- high 취약점 전량 해소(prod 6건 + dev 19건) ([#202](https://github.com/kisagge/blog-project/pull/202))
- moderate·low 취약점 전량 해소 — pnpm audit 0건 ([#203](https://github.com/kisagge/blog-project/pull/203))

### Removed

- 로그라이크 텍스트 RPG 완전폐기(코드·DB·문서 제거) ([#191](https://github.com/kisagge/blog-project/pull/191))

## [0.100.1] - 2026-06-25

### Fixed

- 관리자에게도 게임 메뉴 노출 ([#190](https://github.com/kisagge/blog-project/pull/190))

## [0.100.0] - 2026-06-25

### Added

- 텍스트 RPG S4 — 영속·리더보드(RogueScore) ([#189](https://github.com/kisagge/blog-project/pull/189))

## [0.99.0] - 2026-06-25

### Added

- 텍스트 RPG S3 — 콘텐츠/밸런스 확장(적·보스·아이템·이벤트) ([#188](https://github.com/kisagge/blog-project/pull/188))

## [0.98.1] - 2026-06-25

### Fixed

- /play 관리자 접근 허용 ([#187](https://github.com/kisagge/blog-project/pull/187))

## [0.98.0] - 2026-06-25

### Added

- 텍스트 RPG S2 — /play 회원 전용 텍스트 UI ([#186](https://github.com/kisagge/blog-project/pull/186))

## [0.97.0] - 2026-06-25

### Added

- 텍스트 RPG S1 — lib/game/rogue 순수 엔진 + 단위 테스트 ([#185](https://github.com/kisagge/blog-project/pull/185))

## [0.96.0] - 2026-06-25

### Changed

- SRPG 아카이브 + 로그라이크 텍스트 RPG로 피벗(기획서) ([#184](https://github.com/kisagge/blog-project/pull/184))

## [0.95.0] - 2026-06-25

### Added

- SRPG S4 — 데미지 프리뷰 + 온보드 HP 바 + 다중 맵 ([#183](https://github.com/kisagge/blog-project/pull/183))

## [0.94.0] - 2026-06-25

### Added

- SRPG S3 — 플레이 가능한 단일 전투 + 카메라/잘림 수정 ([#182](https://github.com/kisagge/blog-project/pull/182))

## [0.93.0] - 2026-06-24

### Added

- SRPG S2 — /play 라우트 + three.js 지연 로드 정적 캔버스 ([#181](https://github.com/kisagge/blog-project/pull/181))

## [0.92.0] - 2026-06-24

### Added

- SRPG S1 — 순수 게임 로직 코어 + 단위 테스트 ([#180](https://github.com/kisagge/blog-project/pull/180))

## [0.91.0] - 2026-06-24

### Added

- 커뮤니티 검색 필터 바 — 정렬 토글 + 인기 태그 칩 ([#178](https://github.com/kisagge/blog-project/pull/178))

## [0.90.0] - 2026-06-24

### Added

- 태그 페이지 동적 OG 이미지 ([#177](https://github.com/kisagge/blog-project/pull/177))

## [0.89.0] - 2026-06-24

### Added

- 시리즈별 RSS 피드 + 공유 빌더 추출 ([#176](https://github.com/kisagge/blog-project/pull/176))

## [0.88.1] - 2026-06-24

### Added

- 댓글 정렬을 접근성 세그먼트 토글로 개선 ([#175](https://github.com/kisagge/blog-project/pull/175))

## [0.88.0] - 2026-06-24

### Added

- 글(피드 포스트) 이모지 리액션 ([#174](https://github.com/kisagge/blog-project/pull/174))

## [0.87.4] - 2026-06-24

### Changed

- 운영 견고화 묶음 — 레이트리밋 버킷 상한·실패 로깅·푸시 일괄정리·a11y·테스트 ([#173](https://github.com/kisagge/blog-project/pull/173))

## [0.87.3] - 2026-06-23

### Added

- 댓글 유실방지 + 예약 시각 미리보기 + 무한스크롤 스켈레톤 ([#172](https://github.com/kisagge/blog-project/pull/172))

## [0.87.2] - 2026-06-23

### Fixed

- 예약 발행을 앱 내부 스케줄러로 전환(정시성) ([#171](https://github.com/kisagge/blog-project/pull/171))

## [0.87.1] - 2026-06-22

### Added

- 비밀번호 재설정 코드 메일 브랜드 HTML 템플릿 ([#170](https://github.com/kisagge/blog-project/pull/170))

## [0.87.0] - 2026-06-22

### Added

- 예약 발행 — 관리자 생성 시 지정, cron 자동 게시 ([#169](https://github.com/kisagge/blog-project/pull/169))

## [0.86.2] - 2026-06-22

### Added

- 좋아요 실패 롤백 + 알림 미읽음 인덱스 + 조회수 원자성 ([#168](https://github.com/kisagge/blog-project/pull/168))

## [0.86.1] - 2026-06-22

### Fixed

- 리액션 액션 실패(429 등) 시 낙관 토글 롤백 ([#167](https://github.com/kisagge/blog-project/pull/167))

## [0.86.0] - 2026-06-22

### Added

- 댓글 이모지 리액션 — ♥ 좋아요와 공존 ([#166](https://github.com/kisagge/blog-project/pull/166))

## [0.85.4] - 2026-06-22

### Fixed

- 한글 태그 라우트 [slug] URL 디코딩 — 태그 클릭 404 해결 ([#165](https://github.com/kisagge/blog-project/pull/165))

## [0.85.3] - 2026-06-21

### Fixed

- 한글 태그 슬러그 NFC/NFD 정규화 — 태그 클릭 404 해결 ([#164](https://github.com/kisagge/blog-project/pull/164))

## [0.85.2] - 2026-06-21

### Changed

- .claude/ 로컬 상태 gitignore + 추적 해제 ([#163](https://github.com/kisagge/blog-project/pull/163))

### Fixed

- "use server" 파일의 type 재-export 제거(글 작성/수정 500) ([#162](https://github.com/kisagge/blog-project/pull/162))

## [0.85.1] - 2026-06-21

### Fixed

- 태그 인덱스→상세 404 제거(상세를 작성자 무관화) ([#161](https://github.com/kisagge/blog-project/pull/161))

## [0.85.0] - 2026-06-21

### Added

- 태그 전용 라우트 + 프로필 댓글 딥링크 ([#160](https://github.com/kisagge/blog-project/pull/160))

## [0.84.1] - 2026-06-21

### Added

- JS 스무스 스크롤 reduced-motion 존중 + 일관 포커스 링 ([#159](https://github.com/kisagge/blog-project/pull/159))

### Changed

- Bump the minor-and-patch group with 3 updates ([#156](https://github.com/kisagge/blog-project/pull/156))

## [0.84.0] - 2026-06-21

### Added

- 헬스 엔드포인트 + Docker healthcheck + 관리자 감사 로그 ([#158](https://github.com/kisagge/blog-project/pull/158))

## [0.83.0] - 2026-06-21

### Added

- 회원 팔로우 + 활동 피드 ([#157](https://github.com/kisagge/blog-project/pull/157))

## [0.82.0] - 2026-06-19

### Added

- 시리즈/컬렉션 — 관리자 글 순서 묶음 ([#155](https://github.com/kisagge/blog-project/pull/155))

## [0.81.0] - 2026-06-19

### Added

- 회원 글 인라인 이미지 업로드 ([#154](https://github.com/kisagge/blog-project/pull/154))

## [0.80.1] - 2026-06-19

### Security

- 매직바이트 검증 + 아바타 고아 파일 정리 ([#152](https://github.com/kisagge/blog-project/pull/152))

## [0.80.0] - 2026-06-19

### Added

- 회원 프로필 bio·아바타 ([#151](https://github.com/kisagge/blog-project/pull/151))

## [0.79.0] - 2026-06-19

### Added

- 홈 WebSite + Organization JSON-LD ([#150](https://github.com/kisagge/blog-project/pull/150))

## [0.78.0] - 2026-06-19

### Added

- 피드 목록 제목·슬러그 검색 ([#149](https://github.com/kisagge/blog-project/pull/149))

## [0.77.6] - 2026-06-19

### Changed

- nodemailer 8 → 9 업그레이드 ([#148](https://github.com/kisagge/blog-project/pull/148))

## [0.77.5] - 2026-06-19

### Changed

- npm minor/patch 그룹 + docker/login-action v4 ([#147](https://github.com/kisagge/blog-project/pull/147))

## [0.77.4] - 2026-06-19

### Changed

- GitHub Actions 메이저 일괄 업그레이드 + @types/node 메이저 고정 ([#145](https://github.com/kisagge/blog-project/pull/145))

## [0.77.3] - 2026-06-19

### Changed

- Node 런타임 LTS 24로 업그레이드 (22 → 24) ([#144](https://github.com/kisagge/blog-project/pull/144))

## [0.77.2] - 2026-06-19

### Changed

- prettier·audit 게이트 + Dependabot 자동화 ([#134](https://github.com/kisagge/blog-project/pull/134))

## [0.77.1] - 2026-06-19

### Performance

- 본문 이미지 CLS 방지 + lazy-load ([#133](https://github.com/kisagge/blog-project/pull/133))

## [0.77.0] - 2026-06-19

### Added

- 초안 자동저장(localStorage) + 누적/용량 안전장치 ([#132](https://github.com/kisagge/blog-project/pull/132))

## [0.76.0] - 2026-06-19

### Added

- 마크다운 코드블록 신택스 하이라이팅 ([#131](https://github.com/kisagge/blog-project/pull/131))

## [0.75.0] - 2026-06-19

### Added

- 글 상세 이전/다음 글 · 읽기 진행바 · 맨 위로 ([#130](https://github.com/kisagge/blog-project/pull/130))

## [0.74.0] - 2026-06-19

### Added

- 민감 액션 per-action 레이트리밋 ([#129](https://github.com/kisagge/blog-project/pull/129))

## [0.73.0] - 2026-06-18

### Added

- DB 자동 백업 — sqlite .backup + gzip 회전(GitHub Actions cron) ([#128](https://github.com/kisagge/blog-project/pull/128))

## [0.72.0] - 2026-06-18

### Added

- 공개 인기 글 + 태그 인덱스 페이지 ([#127](https://github.com/kisagge/blog-project/pull/127))

## [0.71.0] - 2026-06-18

### Added

- 글 상세 JSON-LD(BlogPosting+Breadcrumb) + canonical ([#125](https://github.com/kisagge/blog-project/pull/125))

## [0.70.1] - 2026-06-18

### Fixed

- next.config가 lib import로 프로덕션 기동 실패(502) → 인라인 ([#124](https://github.com/kisagge/blog-project/pull/124))

## [0.70.0] - 2026-06-18

### Added

- HTTP 보안 헤더(CSP·HSTS 등) + 후보 백로그 기록 ([#123](https://github.com/kisagge/blog-project/pull/123))

## [0.69.0] - 2026-06-18

### Added

- 검색 결과 스니펫 + 검색어 하이라이트 ([#122](https://github.com/kisagge/blog-project/pull/122))

## [0.68.2] - 2026-06-18

### Performance

- 멘션 알림 팬아웃 N+1 제거(배치) ([#121](https://github.com/kisagge/blog-project/pull/121))

## [0.68.1] - 2026-06-18

### Changed

- KST 표시 포매터를 lib/kst.ts로 중앙화 ([#120](https://github.com/kisagge/blog-project/pull/120))

## [0.68.0] - 2026-06-18

### Added

- App Router 에러 바운더리(error.tsx + global-error.tsx) ([#119](https://github.com/kisagge/blog-project/pull/119))

## [0.67.3] - 2026-06-18

### Performance

- SQLite WAL + 토글 트랜잭션 + 저장목록 인덱스 ([#118](https://github.com/kisagge/blog-project/pull/118))

## [0.67.2] - 2026-06-18

### Fixed

- 명시 렌더로 SPA 내비 시 위젯 미렌더·화면 깨짐 해결 ([#117](https://github.com/kisagge/blog-project/pull/117))

## [0.67.1] - 2026-06-18

### Fixed

- 코드 전송 시 백엔드 오류로 화면 깨짐 방지 ([#116](https://github.com/kisagge/blog-project/pull/116))

## [0.67.0] - 2026-06-18

### Added

- 댓글 @멘션 + 멘션 알림 ([#115](https://github.com/kisagge/blog-project/pull/115))

## [0.66.0] - 2026-06-18

### Added

- 글 상세 하단 관련 글 추천(같은 태그) ([#114](https://github.com/kisagge/blog-project/pull/114))

## [0.65.0] - 2026-06-18

### Added

- 통계 대시보드(/admin/stats) — 조회·가입 추이·인기글 ([#113](https://github.com/kisagge/blog-project/pull/113))

## [0.64.2] - 2026-06-18

### Fixed

- 알림 설정 변경 없으면 저장 버튼 비활성화 ([#112](https://github.com/kisagge/blog-project/pull/112))

## [0.64.1] - 2026-06-18

### Changed

- 알림 설정 진입을 알림 센터 톱니바퀴로 이동 ([#111](https://github.com/kisagge/blog-project/pull/111))

## [0.64.0] - 2026-06-18

### Added

- 회원별 알림 환경설정(종류별 on/off) ([#110](https://github.com/kisagge/blog-project/pull/110))

## [0.63.0] - 2026-06-17

### Added

- 글 저장(북마크) + 저장한 글 모아보기 ([#109](https://github.com/kisagge/blog-project/pull/109))

## [0.62.0] - 2026-06-17

### Added

- 피드 전문 검색 — SQLite FTS5 (trigram + BM25) ([#108](https://github.com/kisagge/blog-project/pull/108))

## [0.61.0] - 2026-06-17

### Added

- SSE 재접속 시 피드 채널 자동 재동기화 ([#107](https://github.com/kisagge/blog-project/pull/107))

## [0.60.1] - 2026-06-17

### Fixed

- 비회원 뷰어에겐 작성자 링크 대신 평문 ([#106](https://github.com/kisagge/blog-project/pull/106))

## [0.60.0] - 2026-06-17

### Added

- 글 좋아요 실시간 + 피드 SSE 연결 provider 공유 ([#104](https://github.com/kisagge/blog-project/pull/104))

## [0.59.0] - 2026-06-17

### Added

- 실시간 댓글 좋아요 수 + 좋아요 디바운스 ([#103](https://github.com/kisagge/blog-project/pull/103))

## [0.58.0] - 2026-06-17

### Added

- 신고 하위 탭 분리 + 라이브 배지 ([#102](https://github.com/kisagge/blog-project/pull/102))

## [0.57.0] - 2026-06-17

### Added

- 본인 댓글 수정 + SSE 라이브 ([#101](https://github.com/kisagge/blog-project/pull/101))

## [0.56.2] - 2026-06-17

### Fixed

- 인기순에서 삭제된 댓글을 하단으로 ([#100](https://github.com/kisagge/blog-project/pull/100))

## [0.56.1] - 2026-06-17

### Fixed

- 이벤트 버스 레지스트리를 globalThis 싱글톤으로 ([#99](https://github.com/kisagge/blog-project/pull/99))

## [0.56.0] - 2026-06-17

### Added

- SSE 실시간 댓글 스레드 ([#98](https://github.com/kisagge/blog-project/pull/98))

## [0.55.0] - 2026-06-17

### Added

- SSE 실시간 알림 벨 ([#97](https://github.com/kisagge/blog-project/pull/97))

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
