# 변경 이력

이 프로젝트의 주요 변경을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/)를 따르며, 버전은 [유의적 버전](https://semver.org/lang/ko/)(pre-1.0: feat=minor, fix/chore=patch)을 사용합니다. 세부 커밋 이력은 git 로그를 참고하세요. 0.55.0 이후 항목의 링크는 해당 변경의 PR입니다.

## [0.116.0] - 2026-11-27

### Added

- **가입 결과 메일**: 관리자가 승인·거절하면 신청자에게 메일(승인 → 로그인 링크, 거절 → 재신청 안내 — 거절 사유는 관리자 참고용이라 담지 않음). 메일 템플릿을 공용 틀로 정리(재설정 메일 출력은 그대로), 닉네임 HTML 이스케이프
- **관리자에게 새 가입 신청 알림**: 인앱 알림 + 웹 푸시(승인 대기 화면 링크), 관리자 메뉴 "회원"에 가입 대기 수 배지
- 알림·메일 실패는 가입 접수·승인 처리를 막지 않음(로그만)

### Fixed

- 관리자 메뉴: 신고 배지가 일반 `span`의 `aria-label`(낭독기가 무시할 수 있음)이던 것 → 링크 이름에 포함된 화면 낭독기용 텍스트, 메뉴에 `aria-label`·현재 탭 `aria-current`

## [0.115.0] - 2026-11-27

### Added

- **업로드 이미지 오프사이트 백업**: 매일 백업 워크플로가 서버의 `data/uploads`를 묶어 DB와 같은 공개키로 암호화한 아티팩트(`uploads-backup-…`, 90일)로 보관 — 지금까지는 DB만 백업돼 인스턴스를 잃으면 본문·아바타 이미지가 모두 사라졌음. 묶기가 실패해도 DB 사본은 보관. 복원 절차 `docs/deploy/lightsail.md` 7-1
- **고아 업로드 정리**: 하루 1회 보존 정리에서 어디에서도 참조하지 않고 30일 지난 업로드 파일(작성 취소·본문에서 뺀 이미지)과 소유 기록 삭제(`lib/upload-cleanup.ts`, 로그 `orphanUploads=`) ([#255](https://github.com/kisagge/blog-project/pull/255))

## [0.114.0] - 2026-11-25

### Added

- **회원 탈퇴**(`/account/withdraw`, 내 계정 하단 링크): 비밀번호 재확인 + 확인 체크 + 회원당 요청 제한
  - 이메일·비밀번호·닉네임·자기소개·아바타·알림 설정은 지우고 모든 기기에서 로그아웃
  - 글·댓글·좋아요·반응은 "탈퇴한 회원"으로 보존(남의 답글·댓글이 끊기지 않게), 원하면 내 글도 함께 삭제
  - 임시저장·팔로우·알림·푸시 구독·저장한 글은 삭제, 탈퇴 회원 프로필은 404, 작성자 링크 없음
  - 같은 이메일로 다시 가입 가능. "탈퇴한 회원" 닉네임은 예약(사칭 방지)
- 관리자 **차단 회원 탈퇴 처리**(회원 관리, 감사 기록): 차단 회원은 로그인할 수 없어 삭제 요청을 관리자가 대행. 이메일은 SHA-256 해시로만 남겨 같은 이메일 재가입(차단 회피)을 막음
- DB: `User.withdrawnAt`, `BlockedEmail` 테이블(마이그레이션 `20261125000000_member_withdrawal`) ([#254](https://github.com/kisagge/blog-project/pull/254))

## [0.113.14] - 2026-11-25

### Fixed

- (CI) 백업 워크플로가 `apt-get update` 없이 `age`를 설치 — 러너의 패키지 목록이 오래되면 404로 실패해 오프사이트 사본이 빠질 수 있었음
- (CI) 예약 발행 수동 트리거의 `.env` 해석이 CRLF(`\r`이 붙은 값 → 401)·작은따옴표·`export` 접두사·중복 정의에서 깨지던 것 → `scripts/publish-scheduled-remote.sh`로 옮기고 테스트 ([#253](https://github.com/kisagge/blog-project/pull/253))

### Changed

- (CI) 서버 앱 경로 `/srv/byjang` 하드코딩 5곳 → 워크플로 `DEPLOY_DIR` 환경 변수로 원격 스크립트에 전달. 클린 코드 리팩토링 계획(#240–#253) 완료 — 계획 문서를 `docs/plans/archive/`로 ([#253](https://github.com/kisagge/blog-project/pull/253))

## [0.113.13] - 2026-11-25

### Fixed

- 글 목록 무한 스크롤이 멈추던 문제 — 다음 페이지 요청이 실패하면(요청 제한·네트워크) 불러오는 중 상태가 풀리지 않아 더 이상 불러오지 않았음. 실패 안내 + 다시 시도 버튼
- 스크롤 중 새 글이 올라와 항목이 밀리면 같은 글이 두 번 보이던 문제(저장 목록과 같은 중복 제거 공용화)
- 커뮤니티 정렬 토글이 `aria-current` → 토글 버튼 의미에 맞게 `aria-pressed` ([#252](https://github.com/kisagge/blog-project/pull/252))

### Performance

- 글 상세: 관리자 닉네임·차단 여부·이전/다음·시리즈·관련 글을 차례로 조회하던 것을 병렬로(관리자 닉네임은 관리자 글일 때만)

### Changed

- (내부) 글 상세 접근 판정 `feedDetailView`(임시저장 미리보기·숨김·공개 범위)를 본문·메타데이터가 공유, 상태×역할 표 테스트와 메타데이터 게이트 테스트 추가. 목록 로드 로직 정리(동기화 ref 5개 → 1개) ([#252](https://github.com/kisagge/blog-project/pull/252))

## [0.113.12] - 2026-11-25

### Fixed

- 던파 캐릭터 상세: 아이템 이미지의 대체 텍스트가 바로 옆 이름과 같아 화면 낭독기가 이름을 두 번 읽던 것 → 장식용(`alt=""`), 최근 활동 시각을 `<time datetime>`(KST 오프셋 포함)으로 ([#251](https://github.com/kisagge/blog-project/pull/251))

### Changed

- (내부) 던파 캐릭터 상세 페이지(716줄) 분리 — 데이터 로드(`load.ts`), 탭 구성(`character-tabs.tsx`), 탭별 섹션(`sections/` 능력치·장비·스킬·아바타·활동), 공용 `ItemRow`·`StatGrid`, 순수 포맷터 테스트(버프 설명·마법부여·시각) ([#251](https://github.com/kisagge/blog-project/pull/251))

## [0.113.11] - 2026-11-25

### Fixed

- 글 저장(북마크) 실패 시 되돌리지 않던 문제 — 요청 제한(429) 등으로 실패해도 "저장됨"으로 남고 처리 안 된 promise 거부가 발생
- 로그인 안내 대화상자: 참여 버튼마다 하나씩 생기던 것(댓글 N개면 2N+α개)을 글 영역에 1개로, 접근 가능한 이름(`aria-labelledby`)과 닫기 버튼 추가. 댓글 삭제 확인 대화상자에도 이름 연결
- 이모지 반응 선택 메뉴(`role="menu"`)에 방향키·Home/End 이동(ARIA menu 패턴)
- 관리자 화면에서 헤더 벨과 관리자 내비가 `/api/events` 연결을 각각 열던 것 → 탭당 1개 공유 ([#250](https://github.com/kisagge/blog-project/pull/250))

### Changed

- (내부) 낙관적 토글 공용 훅 `useOptimisticToggle(s)`(좋아요·댓글 좋아요·저장·반응 — 디바운스·짝수 연타 생략·실패 시 되돌림·재동기화 가드), 글·댓글 반응 컴포넌트를 `ReactionBar` 하나로(각 200줄 → 데이터 출처만 다른 얇은 래퍼), `LoginPromptProvider`, `useServerEvent` ([#250](https://github.com/kisagge/blog-project/pull/250))

## [0.113.10] - 2026-11-23

### Fixed

- 이미지 업로드가 "업로드 중"에 멈추던 문제 — 회원 글 작성기·내 정보 아바타는 업로드 요청이 예외로 끝나면(네트워크 오류·본문 크기 한도) 업로드 입력(아바타는 저장 버튼까지)이 영구 비활성. 아바타는 형식·크기 선검증도 없어 5MB 초과 파일이 바로 이 상태로 이어졌음
- 서버 검증 오류 후 입력이 지워지던 문제 — 회원가입(이메일·닉네임)·관리자 글·시리즈 폼. React 19가 action 제출 후 비제어 폼을 초기화하므로, 실패 응답에 제출값(비밀번호 제외)을 담아 입력을 다시 채움
- 편집기 작성/미리보기 탭에 방향키·Home/End 이동과 roving tabindex(WAI-ARIA 탭 패턴) ([#249](https://github.com/kisagge/blog-project/pull/249))

### Changed

- (내부) 편집기 공용 훅·부품 — `useImageUpload`(업로드 4곳), `insertIntoTextarea`(캐럿 삽입 2곳), `TabList`(편집기 탭 2벌 + 던파 탭), `useDraft`(관리자·회원 편집기의 초안 정리·복원·디바운스 저장·실패 시 보존) ([#249](https://github.com/kisagge/blog-project/pull/249))

## [0.113.9] - 2026-11-23

### Fixed

- 폼 접근성: 회원가입·비밀번호 재설정·시리즈 폼의 필드 오류가 입력과 연결되지 않던 것(`aria-invalid`·`aria-describedby`·`role="alert"` 누락)과 회원 글 작성기·내 정보의 일부 누락을 보완, 비밀번호 규칙 안내를 입력의 설명으로 연결, 가입·재설정·닉네임 입력에 `autocomplete` ([#248](https://github.com/kisagge/blog-project/pull/248))

### Changed

- (내부) 공용 `FormField`(이름표·안내문·오류 연결) — 가입·재설정·관리자 글·시리즈·회원 글·내 정보 폼의 제각각이던 필드 틀 3벌과 수작업 연결 대체, 비밀번호 안내 문구 상수(`PASSWORD_HINT`), 필드 오류 스타일 통일(`FIELD_ERROR`) ([#248](https://github.com/kisagge/blog-project/pull/248))

## [0.113.8] - 2026-11-23

### Fixed

- 마크업·접근성: 메뉴 드로어가 `dialog` 역할을 가질 수 없는 `<aside>`였던 것을 `<div role="dialog">`로, 던파 장비 행의 `<span>` 안 `<div>`(인라인 안 블록) 수정, 알림 "안읽음" 표시가 일반 `span`의 `aria-label`(낭독기가 무시할 수 있음)이던 것을 화면 낭독기용 텍스트로 ([#247](https://github.com/kisagge/blog-project/pull/247))
- 던파 캐릭터 상세 탭이 선택 상태를 알리지 않던 일반 버튼 → ARIA 탭(tablist/tab/tabpanel, 선택 상태, 방향키·Home/End 이동)
- 관리자 신고 큐·가려진 콘텐츠·예약 글 목록의 시각을 `<time datetime>`으로

### Changed

- (내부) 공용 UI 부품 `app/ui` — `KstTime`(시각 표시 13곳), `AuthorName`(작성자 링크/텍스트 5곳), `LinkTabs`(회원·신고·계정 탭 3벌), `FeedCardList`(인기·태그·시리즈·팔로잉 목록), 폼의 `inputCls = INPUT_CLASS` 별칭 제거 ([#247](https://github.com/kisagge/blog-project/pull/247))

## [0.113.7] - 2026-11-23

### Changed

- (내부) 서버 액션·API 정리 — 실시간 스트림(SSE) 응답 공용 헬퍼(`lib/sse`, 수명주기 테스트 추가), 공개 폼(가입·로그인·재설정 요청)의 요청 제한+CAPTCHA 앞단 공용화(`lib/form-guard`), "로그인 필요" 문구 상수화, 폐기 예정 zod `flatten()` → `z.flattenError`, 관리자 폼 상태를 공용 `FormState`로 통일, 재검증 경로 묶음, `app/admin/actions.ts`를 글·회원·사이트 설정 액션으로 분리. 화면·동작 변화 없음 ([#246](https://github.com/kisagge/blog-project/pull/246))

## [0.113.6] - 2026-11-23

### Changed

- (내부) 도메인 모듈 정리 — 회원 글 게시를 세 갈래(게시 글 수정·초안 게시·신규 게시)로 나누고 반복 단계(본인 글 조회·태그 교체·하루 제한·생성)를 헬퍼로, 신고 큐·숨김 목록의 대상 로드·요약·숨김 토글 공용화, 관리자 예약 계정을 `lib/admin-user`로 분리, 예약 발행·보존 정리 스케줄러의 공용 주기 작업 헬퍼, 결과 타입 통일. 화면·동작 변화 없음 ([#245](https://github.com/kisagge/blog-project/pull/245))

### Security

- 관리자 예약 계정(`admin@byjang.local`) 선점 방지 — 예약 도메인 가입 거부, 예약 행 보장 시 같은 이메일의 기존 행을 로그인 불가 해시·승인 상태로 덮어씀, 회원 로그인은 회원 행만 허용. 예약 계정이 생기기 전에 그 이메일로 가입·승인되면 관리자 신원(댓글 작성자·신고 알림 수신)을 가로챌 수 있던 문제(기존 결함, 관리자 권한 자체는 env 비밀번호라 무관) ([#245](https://github.com/kisagge/blog-project/pull/245))

## [0.113.5] - 2026-11-20

### Security

- `ADMIN_PASSWORD`가 비어 있을 때 빈 비밀번호로 관리자 로그인이 통과하던 문제(운영은 값이 설정돼 영향 없음) — 비어 있으면 항상 거부

### Changed

- (내부) 작은 유틸 공용화 — KST 날짜 계산(`lib/kst`로 일원화), 세션 쿠키 이름·수명·JWT 서명/검증·쿠키 보안 옵션(세션·재설정 쿠키·방문자 ID 공용), 비밀번호 재설정 시간 정책(메일 안내 문구도 같은 상수), 이메일 정규화, 폼 공용 필드(제목·slug·이메일), 댓글 고유 링크, 리액션 요약, 상수시간 비교, Neople 캐릭터 경로. 화면·동작 변화 없음 ([#244](https://github.com/kisagge/blog-project/pull/244))

## [0.113.4] - 2026-11-20

### Changed

- (내부) 목록 질의 공용화 — "볼 수 있는 글" 조건을 `visibleFeedWhere(role)` 하나로(19곳, 세 가지 표기 통일), 작성자 범위·페이지 나눔·정렬 순서 공용 헬퍼, `getPublicTopFeeds` → `getVisibleTopFeeds`(뷰어 기준이라는 뜻). 팔로잉·회원 프로필 목록은 같은 시각 게시 글의 순서만 작성일로 고정. 화면 변화 없음 ([#243](https://github.com/kisagge/blog-project/pull/243))

## [0.113.3] - 2026-11-20

### Changed

- (내부) 죽은 코드·낡은 주석·하드코딩 정리 — 미사용 export 5개 삭제·파일 전용 export 13개 비공개화, 도달 불가 분기 제거, 업로드 경로 정규식·댓글 길이 상한·사이트 이름/주소·429 재시도 시간을 한 곳의 상수로, 서버 전용 모듈 표시 보강, 다크 테마에서 효과 없던 중복 클래스 25개 제거, 테마 초기화 스크립트를 테마 상수로 생성. 화면·동작 변화 없음 ([#242](https://github.com/kisagge/blog-project/pull/242))

## [0.113.2] - 2026-11-20

### Changed

- (내부) 테스트 DB를 실제 마이그레이션으로 생성 — 손으로 옮겨 적던 290줄 DDL 제거(전환 전 두 스키마 일치 비교 검증). 테스트 공용 픽스처(`test/helpers.ts`)와 `server-only` 별칭으로 59개 테스트 파일의 반복 코드 정리. 앱 동작 변화 없음 ([#241](https://github.com/kisagge/blog-project/pull/241))

## [0.113.1] - 2026-11-20

### Security

- 던파 캐릭터 상세의 제목·공유 미리보기(OG)에 비공개·미등록 캐릭터 이름과 이미지가 실리던 문제 — 본문과 같은 공개 범위 확인(회원공개는 비회원에게 이름 없이 noindex)
- 점검 모드에서 던파(/df)·회원 프로필(/u) 페이지가 막히지 않던 문제
- 관리자 공개 범위 변경 액션(글·던파 캐릭터)이 허용값 외 값을 그대로 저장하던 문제

### Fixed

- 글쓰기·수정 화면의 뒤로가기가 '내 정보'로 가던 것을 '내 글'로 ([#240](https://github.com/kisagge/blog-project/pull/240))

## [0.113.0] - 2026-11-20

### Security

- prisma가 고정한 `effect` 3.20.0의 ReDoS 권고(GHSA-7589-6fvf-x4pw, high) — 해당 경로만 3.22.5로 강제(pnpm overrides). CI 감사 게이트 복구

### Added

- 오래된 기록 자동 정리(하루 1회, 배포 10분 뒤 첫 실행) — 조회 기록 180일, 읽은 알림 90일·안 읽은 알림 1년, 감사 로그 1년, 비밀번호 재설정 코드 1일. 정리 후 SQLite `PRAGMA optimize`. 통계·조회수 표시는 영향 없음 ([#239](https://github.com/kisagge/blog-project/pull/239))

## [0.112.1] - 2026-11-19

### Fixed

- 빌드마다 나던 "동적 파일 접근으로 프로젝트 전체가 서버 트레이스에 포함" 경고 4건 제거 — 업로드 경로를 공용 `uploadPath()`로 모으고 런타임 경로임을 표시(`turbopackIgnore`). 업로드 라우트 트레이스 642 → 113 파일(README·docs 등 제외). 배포 이미지는 standalone이 아니라 산출물 변화는 없음 ([#238](https://github.com/kisagge/blog-project/pull/238))

## [0.112.0] - 2026-11-19

### Added

- 메뉴와 홈 "둘러보기"에 시리즈 링크 — 볼 수 있는 시리즈가 있을 때만 표시(이전엔 /series로 가는 링크가 사이트 어디에도 없었음)

### Changed

- 커뮤니티에 글이 없을 때 피드용 문구 대신 "아직 회원이 쓴 글이 없습니다." ([#237](https://github.com/kisagge/blog-project/pull/237))

## [0.111.11] - 2026-11-19

### Fixed

- 회원 전용 페이지(프로필·팔로잉·커뮤니티·회원공개 글)가 검색엔진엔 "회원만 볼 수 있습니다" 안내만 보이는 얇은 페이지로 색인될 수 있던 문제 — `noindex` 메타데이터 추가(robots.txt로 막으면 noindex를 못 읽어 URL만 색인될 수 있어 메타데이터로 처리)
- robots.txt에 /me·/maintenance·/offline.html·/api/ 크롤링 제외 추가 ([#236](https://github.com/kisagge/blog-project/pull/236))

## [0.111.10] - 2026-11-19

### Fixed

- 이미지를 올리면 대체 텍스트가 항상 빈 채(`![](…)`)로 들어가던 문제(접근성) — 회원 글·관리자 글·소개 편집기 모두 삽입 직후 커서를 `[ ]` 안에 두고 "이미지 설명(대체 텍스트)을 입력하세요"를 안내. 입력하지 않으면 장식 이미지(빈 alt)로 남음
- 업로드 상태 안내 영역을 항상 마운트해 스크린리더가 변화를 읽도록 수정 ([#235](https://github.com/kisagge/blog-project/pull/235))

## [0.111.9] - 2026-11-19

### Fixed

- 회원 글·임시저장 삭제가 확인 없이 바로 실행되던 문제 — 확인 창(게시 글은 댓글·좋아요도 함께 삭제됨을 안내), 삭제 버튼 이름에 글 제목 포함
- 임시저장 후 '내 글' 대신 프로필 탭으로 이동하던 문제

### Added

- 내가 쓴 게시 글 상세에서 바로 수정·삭제 ([#234](https://github.com/kisagge/blog-project/pull/234))

## [0.111.8] - 2026-11-19

### Fixed

- 가입 신청이 거절된 회원이 로그인하면 "관리자 승인 대기 중"으로 안내되던 문제 — 승인되지 않았음과 같은 이메일로 다시 신청할 수 있음을 안내(거절 사유는 계속 관리자만 확인) ([#233](https://github.com/kisagge/blog-project/pull/233))

## [0.111.7] - 2026-11-19

### Fixed

- 예약 발행한 글이 목록·검색·태그·아카이브·RSS·이전/다음 글에서 작성일 기준으로 놓여 과거 날짜로 묻히던 문제 — 모든 공개 화면이 게시일 기준으로 정렬·표시(기존 글은 작성일로 백필) ([#232](https://github.com/kisagge/blog-project/pull/232))

## [0.111.6] - 2026-11-18

### Changed

- 배포 시 서버 compose.yaml을 레포 버전으로 자동 동기화(검증·백업·diff 기록) — 컨테이너 로그 회전(10MB×3), healthcheck, 업로드 저장 위치(/data/uploads)가 운영에 적용
- 서버 오류 발생 시 요청 경로·라우트·digest를 로그에 한 줄로 기록(오류 화면의 digest로 바로 추적) ([#231](https://github.com/kisagge/blog-project/pull/231))

## [0.111.5] - 2026-11-18

### Fixed

- 배포 스크립트가 healthcheck 없는 서버 compose에서 헬스 상태를 읽지 못해 정상 배포를 실패로 판정하던 문제 — 컨테이너 안에서 /api/health 직접 확인, 컨테이너가 죽으면 즉시 실패 판정 ([#230](https://github.com/kisagge/blog-project/pull/230))

## [0.111.4] - 2026-11-18

### Changed

- 배포 안전장치 — 배포 동시 실행 방지·이전 커밋이 새 배포를 덮어쓰지 않게 커밋 이미지(:sha)로 배포, 마이그레이션 전 DB 자동 백업, 헬스 확인 후 완료 처리, 기동 로그(마이그레이션 출력) 기록 ([#229](https://github.com/kisagge/blog-project/pull/229))

## [0.111.3] - 2026-11-17

### Security

- 점검 모드에서 글 페이지가 /maintenance로 리다이렉트되면서도 응답 안에 글 본문·제목이 실려 나가던 문제 수정 — 레이아웃뿐 아니라 각 페이지·메타데이터에서도 점검 가드
- 점검 모드에서 RSS·시리즈 RSS·llms.txt는 503(Retry-After), 사이트맵은 빈 목록, 글·태그 공유 이미지는 기본 카드 ([#228](https://github.com/kisagge/blog-project/pull/228))

## [0.111.2] - 2026-11-17

### Security

- 서비스 워커가 정적 자산만 캐시하도록 변경 — 로그인·계정·회원 글 화면이 기기에 저장돼 공용 기기에서 로그아웃 후에도 오프라인 시 이전 사용자의 화면이 보일 수 있던 문제 수정, 기존 캐시는 자동 삭제

### Changed

- 오프라인에서 페이지를 열면 안내 페이지 표시(이전에 본 글은 오프라인으로 다시 열 수 없음) ([#227](https://github.com/kisagge/blog-project/pull/227))

## [0.111.1] - 2026-11-17

### Security

- 웹 푸시 구독 주소를 브라우저 푸시 서비스로 제한 — 임의 주소(내부망 등)를 구독으로 등록해 서버가 그 주소로 요청을 보내게 하던 문제(SSRF) 수정, 이미 저장된 비허용 주소는 발송하지 않고 정리
- 푸시 구독 해제는 본인 구독만, 회원당 구독 수·구독 요청 한도 ([#226](https://github.com/kisagge/blog-project/pull/226))

## [0.111.0] - 2026-11-17

### Security

- 회원 세션 무효화 — 차단되거나 비밀번호를 재설정하면 로그인 중인 모든 기기에서 즉시 로그아웃. 이전엔 남은 로그인으로 최대 7일 회원 공개 글을 볼 수 있었음
- 차단 회원은 기존 로그인이 남아 있어도 회원 공개 글 열람 불가 ([#225](https://github.com/kisagge/blog-project/pull/225))

### Changed

- 관리자 회원 차단 확인 창에 "로그인 중인 모든 기기에서 즉시 로그아웃" 안내 추가

## [0.110.4] - 2026-11-16

### Security

- 업로드 파일 소유 기록 추가 — 남의 업로드(다른 회원 아바타·관리자 본문 이미지)를 아바타로 지정한 뒤 교체해 그 파일을 삭제할 수 있던 문제 수정. 아바타는 본인이 올린 이미지만, 교체 시 삭제도 본인 파일만

### Fixed

- 같은 아바타를 다시 저장할 때 쓰는 중인 파일이 지워질 수 있던 문제, 저장 시 아바타 검증 오류가 화면에 보이지 않던 문제 ([#224](https://github.com/kisagge/blog-project/pull/224))

### Changed

- 의존성 마이너·패치 업데이트 14건(next 16.4.6, react 19.3.1, mermaid 12.3.0, tailwindcss 4.3.5 등) ([#221](https://github.com/kisagge/blog-project/pull/221))

## [0.110.3] - 2026-11-16

### Security

- 댓글·좋아요·리액션·북마크·조회수 액션이 글 상세와 같은 접근 확인을 거치도록 수정 — 비공개·숨김 글에 댓글을 달거나 회원공개 글 댓글을 비로그인이 조회하던 문제, 알림 링크를 클라이언트가 정하던 문제 차단
- 댓글 작성(회원당)·조회 기록(IP당) 요청 한도, 댓글 재동기화 조회 상한

### Fixed

- 북마크 버튼 연타 시 서버 오류가 나던 문제, 프로필 최근 댓글에 신고로 숨겨진 글 제목이 보이던 문제 ([#223](https://github.com/kisagge/blog-project/pull/223))

## [0.110.2] - 2026-11-16

### Security

- 비밀번호 재설정 코드 무차별 대입 차단 — 시도 횟수를 검증 전에 원자적으로 선점(병렬 요청으로 상한 초과 불가), 이메일당 코드 발급·검증 한도와 IP당 검증 한도 추가
- 관리자 로그인에 IP당 시도 한도(5회/15분)
- 차단된 회원이 같은 이메일로 다시 가입해 차단을 풀거나 비밀번호를 덮어쓰던 문제 수정 ([#222](https://github.com/kisagge/blog-project/pull/222))

## [0.110.1] - 2026-11-12

### Security

- 클라이언트 IP를 `X-Forwarded-For` 마지막 항목(nginx가 덧붙인 실제 주소)으로 판별 — 첫 항목 위조로 모든 IP 요청 제한을 우회하던 문제 수정, 버킷 상한 초과 시 전체 초기화 대신 오래된 키만 정리 ([#220](https://github.com/kisagge/blog-project/pull/220))

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
