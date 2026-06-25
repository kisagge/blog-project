# 기술 개요 — BY Playground

개인 블로그(공개 피드 + 회원 커뮤니티 + 관리자 CMS)를 직접 설계·구현하고 자체 서버(AWS Lightsail)에 Docker로 배포·운영한 프로젝트. 개발부터 CI/CD, 인프라 운영까지 1인이 담당.

> 영문: [tech-spec.en.md](tech-spec.en.md)

## 1. 요약

- **유형**: 개인 풀스택 웹앱 — 공개 피드 · 던파 캐릭터 쇼케이스 · 회원 커뮤니티(댓글·좋아요·알림) · 관리자 CMS
- **스택**: Next.js 16 (App Router · Server Actions) · React 19 · Prisma 7 + SQLite · Tailwind v4 · TypeScript
- **인프라**: Docker · AWS Lightsail · nginx · GitHub Actions (CI/CD)
- **규모**: 단일 저장소, SQLite 단일 DB, 컨테이너 1개로 운영하는 경량 구성

## 2. 아키텍처

```
방문자/회원 ─ HTTPS ─> nginx ──┬─ /uploads/*  → 디스크 볼륨에서 직접 서빙(정적)
                               └─ /*          → Next.js (next start, :3010, loopback)
                                                   │
                                  proxy.ts ─ 전역 IP 속도 제한 + /admin 가드
                                                   │
                                  Server Actions / RSC
                                       │                    │
                          Prisma 7(어댑터) → SQLite     web-push → 브라우저 푸시
                                                            nodemailer(SMTP) → 메일

CI/CD: main push → GitHub Actions
        test(tsc·eslint·vitest) → 이미지 빌드·GHCR 푸시 → SSH 배포(pull & compose up + migrate deploy)
```

- **렌더링**: 공개 목록은 첫 페이지를 서버 렌더(SEO·초기 응답), 이후 클라이언트가 Server Action으로 증분 로드.
- **인증·권한**: jose로 서명한 JWT 세션 쿠키. 세션은 `admin | member` 유니온. `proxy.ts`(Next 16 미들웨어, Node 런타임)가 `/admin`을 보호하고 전역 요청 속도 제한을 적용.
- **파일**: 업로드 이미지는 볼륨에 저장하고 nginx가 앱을 거치지 않고 직접 서빙.

## 3. 기술 스택

| 영역       | 기술                            | 버전       | 선택 이유                                                              |
| ---------- | ------------------------------- | ---------- | ---------------------------------------------------------------------- |
| 프레임워크 | Next.js (App Router)            | 16.2.9     | Server Actions·RSC로 API 레이어 없이 데이터 변경 처리                  |
| UI         | React / Tailwind CSS            | 19.2 / v4  | —                                                                      |
| ORM/DB     | Prisma / SQLite                 | 7.8 / —    | 드라이버 어댑터(better-sqlite3 12.10)로 런타임 쿼리 엔진 바이너리 제거 |
| 인증       | jose (JWT)                      | 6.2        | 미들웨어에서도 검증 가능한 경량 서명                                   |
| 콘텐츠     | react-markdown + remark-gfm     | 10.1 / 4.0 | 본문 마크다운 렌더                                                     |
| 검증       | zod                             | 4.4        | 폼·업로드 입력 검증                                                    |
| 알림/메일  | web-push / nodemailer           | —          | VAPID 웹 푸시 · SMTP(SES) 트랜잭션 메일                                |
| 정렬 UI    | @dnd-kit                        | —          | 던파 캐릭터 드래그 정렬                                                |
| 테스트     | Vitest                          | 4.1        | 순수 로직 + 임시 SQLite 통합 테스트                                    |
| 빌드/배포  | Docker · GitHub Actions · nginx | —          | GHCR 이미지 + SSH 배포                                                 |

## 4. 주요 엔지니어링

### 4.1 컨테이너 이미지 최적화 — 2.05GB → 876MB (−57%)

배포가 느려 행/타임아웃되는 문제를 추적해, 런타임 이미지를 분석하고 세 가지 비대화 원인을 제거.

- **prod 의존성 분리**: 런너에서 `pnpm install --prod`로 dev 의존성 제외 (node_modules 934MB→676MB).
- **빌드 툴 격리**: `python3/make/g++`를 빌드 전용 스테이지로 분리, 런타임엔 컴파일된 네이티브 바이너리만 복사.
- **레이어 중복 제거**: `chown -R`이 overlay FS에서 node_modules 전체(~640MB)를 새 레이어로 복제하던 것을 `COPY --chown`으로 대체.
- **결과**: 배포 시 첫 pull 시간 **10분 32초 → 37초**. 로컬에서 실제 컨테이너로 마이그레이션·쿼리·업로드까지 검증 후 반영.

### 4.2 배포 파이프라인 진단·안정화

운영 중 발생한 배포 장애를 로그·시스템 지표로 원인 규명하고 단계적으로 보강.

- **디스크 고갈**: 누적된 미사용 이미지로 `/`가 차서 레이어 압축 해제가 정지 → `pull` 전 정리 단계 추가 + 단계별 계측 로깅.
- **메모리 부족(OOM)**: 512MB 인스턴스에서 배포 중 OOM으로 컨테이너 사망(→ 504) → 스왑 2GB 추가로 해소, 인스턴스 증설 권고.
- **배포 워크플로**: `test → build/push(GHCR) → SSH 배포(+ `prisma migrate deploy`)`. 수동 트리거(workflow_dispatch) 지원, 타임아웃으로 실패 가시화.
- **CI 위생 게이트**: test 잡이 `tsc → eslint → prettier --check → vitest → pnpm audit(--prod --audit-level critical)`를 통과해야 빌드·배포로 진행. 포맷·**critical 런타임 취약점** 회귀를 머지 전 차단(현 prod 취약점은 전부 `prisma>@prisma/dev>hono` 전이의존이라 critical 게이트는 green 유지, high/moderate는 Dependabot이 처리).
- **의존성 자동화**: `.github/dependabot.yml`이 npm·GitHub Actions·Docker 베이스이미지를 주간 점검, minor/patch는 그룹 PR 1개로 묶고 major는 개별 PR로 분리(공급망·핀 회귀 차단, PR 노이즈 최소화).
- **헬스체크 + 행 감지**: `/api/health`가 `SELECT 1` DB 핑까지 확인(상태 문자열만 반환, 내부정보 미노출)하고 `compose.yaml` `healthcheck`가 30초마다 프로브 — `restart: unless-stopped`가 못 잡는 "응답은 살아있되 DB가 죽은 행" 상태를 감지해 컨테이너를 unhealthy로 표시·재시작 유도. 런타임 이미지에 curl/wget이 없어 **node 글로벌 fetch**로 프로브, `start_period`로 `migrate deploy`+`next start` 기동 시간 확보. 헬스는 `proxy.ts` matcher에서 제외해 IP 레이트리밋·`/admin` 가드를 우회(프로브가 항상 응답).
- **관리자 감사 로그**: 거버넌스 액션(글 CRUD·공개범위, 회원 승인/거절/차단, 신고 숨김/복구/기각, 시리즈 CRUD, 점검모드, 관리자 닉네임)을 `logAudit`로 `AuditLog`에 append. 관리자는 싱글톤이라 "누가"는 자명 → **무엇·언제 + 작성 시점 요약 스냅샷**(대상 삭제돼도 보존)을 `/admin/audit`에서 최신순 열람. `logAudit`은 best-effort(throw 안 함)라 감사 실패가 거버넌스 액션을 막지 않음.

### 4.3 Prisma 7 드라이버 어댑터

Prisma 7이 내장 쿼리 엔진을 제거함에 따라 `@prisma/adapter-better-sqlite3` 드라이버 어댑터를 도입. 런타임 쿼리에 Rust 엔진 바이너리가 불필요해져 4.1의 이미지 슬림화와 함께 의존성·크기를 추가로 절감.

- **동시성 튜닝**: SQLite를 **WAL 모드**로 전환(`PRAGMA journal_mode=WAL`, 파일 레벨 영구)해 쓰기(조회수 트래킹·댓글·좋아요)가 읽기를 막지 않게 했고, `busy_timeout`은 어댑터 `timeout`으로 명시(5000ms). 좋아요/댓글 좋아요 토글은 `find→토글→count`를 **`$transaction`으로 원자화**해, 동시 토글이 await 사이에 인터리빙돼 카운트가 어긋난 채 SSE로 브로드캐스트되는 것을 방지. 조회수도 **View 기록 + `viewCount` 증가를 한 `$transaction`**으로 묶어(증가 실패 시 둘 다 롤백) 드리프트·고아 View를 방지. 알림 미읽음 카운트(벨 배지)는 `@@index([userId, readAt])`로 부분 스캔 제거.

### 4.4 회원 시스템 — 승인 흐름 + 역할 유니온 세션

비밀번호만으로 들어가는 단일 관리자에서, 가입·승인 흐름을 가진 외부 회원으로 인증을 확장.

- **세션 유니온**: 쿠키 페이로드를 `{role:"admin"} | {role:"member", userId, nickname}` 유니온으로 모델링. 분배형 `Omit` 유틸로 member 전용 필드를 잃지 않고 직렬화.
- **승인 흐름**: 가입은 `pending` 생성 → 관리자 승인 시 `approved`. 거절은 행을 지우지 않고 `rejected` + 사유 기록 → 같은 이메일 재신청 시 같은 행을 `pending`으로 되돌려 과거 사유를 관리자에게 보존.
- **비밀번호 재설정**: 6자리 코드를 메일로 발송(scrypt 해시 저장, 평문 미보관), 3분 만료 + 시도 횟수 제한 + 재발송 쿨다운(메일 폭탄 방지). 코드 메일은 **브랜드 HTML 템플릿**(테이블 레이아웃·인라인 스타일·외부 리소스 0의 이메일 클라이언트 안전 마크업, `lib/email-template.ts` 순수 함수) + **텍스트 폴백** 동시 발송. SMTP 미설정 환경에선 콘솔 로그로 폴백해 로컬 개발을 막지 않음.
- 비밀번호 해시는 표준 라이브러리 `scrypt`(`salt:hash`)로 자체 구현, 외부 의존성 없이 검증.
- **프로필 bio·아바타**: 회원이 `/account`에서 자기소개(160자)와 아바타를 편집해 `/u/[id]`에 표시. 아바타는 **회원 업로드**(관리자 전용 `uploadImage`와 별개 — 저장 로직을 `lib/save-image.ts` `saveImage`로 공유하고 가드만 `getMemberSession`+회원별 레이트리밋으로 교체). `avatarUrl`은 외부 URL·`javascript:` 주입을 막기 위해 **`/uploads/<uuid>.<ext>` 로컬 경로만** zod로 검증, 빈값은 제거. 표시는 이미지 없으면 닉네임 이니셜 플레이스홀더(공용 `Avatar`). 업로드는 선언 MIME뿐 아니라 **매직바이트**(`sniffImageType`)로 실제 내용을 검증해 위장 파일을 차단하고(관리자·회원 공통), 아바타 교체·제거 시 **이전 파일을 디스크에서 정리**(`deleteUpload`).
- **회원 본문 이미지 업로드**: 회원 글 에디터도 아바타와 같은 `saveImage` 인프라(`getMemberSession`+`postImageUpload` 레이트리밋+매직바이트)로 본문 이미지를 업로드. 제어 컴포넌트 textarea라 `spliceText`(순수)로 커서 위치에 `![](…?w&h)`를 삽입하고 `setContent`로 상태·자동저장을 갱신 → #28의 CLS-safe 렌더(width/height·lazy)를 그대로 탄다. 파일 input은 `sr-only`+버튼 트리거로 키보드 접근.

### 4.5 공개 범위 3단계 접근 제어 (피드·던파 공용)

전체공개 / 회원공개 / 비공개(초안)를 SQLite에서 네이티브 enum 없이 앱 레이어 유니온 타입으로 구현하고, 단건과 목록에 일관 적용.

- **단일 판정 함수**: `checkAccess(visibility, role)`(단건: ok / members-only / not-found)와 `listableVisibilities(role)`(목록 필터)로 규칙을 한 곳에 모아 피드·던파가 공유.
- 비공개는 비어드민에게 **404**(존재 자체 숨김), 회원공개는 비로그인에게 **가입 유도 게이트**, 관리자는 비공개 초안까지 목록·상세에서 열람(목록엔 "비공개" 배지). 비공개 글은 공유 버튼을 숨겨 무의미한 외부 링크 노출을 차단.
- 마이그레이션 시 기존 데이터의 의미를 보존(예: 기존 항목을 적절한 등급으로 이관)하도록 데이터 변환 SQL을 수동 작성.

### 4.6 댓글·좋아요·북마크

2뎁스 댓글(답글)과 피드·댓글 좋아요, 개인 북마크를 Server Action으로 구현.

- 답글은 최상위 댓글에만 허용(깊이 검증), 삭제는 자식 유무에 따라 soft/hard 분기. 좋아요는 `(user, 대상)` 유니크로 토글. 작성자는 본인 댓글을 수정 가능(`editedAt` 기록 → "(수정됨)" 표시, SSE로 라이브 반영). 인기순 정렬에서 삭제 댓글은 좋아요 무관 하단(`deletedAt` nulls-first). 좋아요·리액션 버튼은 낙관 토글이 **실패(429 등) 시 롤백**(서버 미반영분만 되돌림, SSE가 카운트 권위 소스 — 댓글·피드 좋아요·리액션 공통). 정렬(인기순/최신순)은 `?sort=` URL 링크 + `key` 리마운트로 서버 정렬을 갈아끼우며(더보기·SSE resync도 같은 `sort` 재전달), 컨트롤은 `role="group"`+`aria-current`의 **접근성 세그먼트 토글**(활성 정렬을 스크린리더에 노출).
- **북마크(저장)**: 좋아요와 동형(`Bookmark` `(user, feed)` 유니크 토글)이나 **회원 전용·개인용**이라 공개 카운트·실시간(SSE) 없음 → 낙관 토글 + 디바운스만(admin은 저장 목록이 없어 버튼·액션에서 제외). `/account/saved`에서 저장 시각 최신순으로 모아보며(목록 카드 마크업은 `FeedCardItem`으로 공개 목록과 공유), 저장 후 비공개·숨김된 글은 회원 가시 범위 필터로 목록에서 제외.
- 관리자 작성 글의 알림 수신을 위해 로그인 불가한 **예약 관리자 User**(싱글톤)를 두어, 세션에 `userId`가 없는 관리자도 도메인 모델에서 작성자/수신자로 표현.
- **댓글 이모지 리액션**: ♥ 좋아요와 **공존**하는 별도 모델(`CommentReaction` `(comment, user, emoji)` 유니크)로 고정 5종(👍 😂 😮 😢 🎉) 반응을 댓글·대댓글에 단다. 좋아요 토글과 **동형** — `$transaction`으로 토글+카운트 원자화, SSE `reaction` 이벤트로 카운트 라이브 전파(본인 `reacted`는 컴포넌트 낙관 상태가 소유 → 타인 반응이 내 토글을 덮어쓰지 않음). 집계는 `getReactionSummaries`가 `groupBy(commentId,emoji)` 1회로 묶어 노드에 부착(좋아요 `likedIds`와 동형, count>0만). 이모지 상수·라벨은 클라이언트 공용 모듈로 분리(`lib/reactions.ts`, DB 함수는 server-only). 칩은 `aria-pressed`, 추가 picker는 `aria-haspopup`/`aria-expanded`+`menuitemcheckbox`(Esc·바깥클릭 닫기·포커스 복귀). 클릭은 낙관 토글+500ms 디바운스(짝수 연타 no-op)이며, **액션 실패 시(글로벌 IP 429 등) 낙관 상태를 롤백**(인플라이트 중 재토글은 레이스 가드로 최신 의도 보존, follow 버튼과 동일 패턴).
- **글 이모지 리액션**: 같은 5종 세트를 **글(피드 포스트)** 본문에도 적용(`FeedReaction` `(feed, user, emoji)` 유니크 — `CommentReaction`과 동형, `lib/reactions.ts` 상수 그대로 재사용). 댓글 리액션은 트리 노드에 부착돼 `comment-section`의 SSE 병합으로 갱신되지만, 글 리액션은 **좋아요 버튼처럼 leaf 컴포넌트가 피드 SSE를 직접 구독**(`feedReaction` 이벤트로 카운트 갱신, 재접속 시 `getFeedReactionSummaryAction`로 재동기화 — 단, 인플라이트 토글이 있으면 낙관 상태를 보존). 좋아요/북마크 줄 아래에 배치하며 글 SSE 연결 1개를 공유한다.

### 4.7 PWA + 웹 푸시 + 인앱 알림

설치형 PWA와 알림을 함께 구축.

- **PWA**: `manifest` + 서비스 워커(오프라인 캐싱) + 아이콘. 서비스 워커는 푸시 수신·클릭 시 해당 URL로 포커스/오픈.
- **웹 푸시**: VAPID(web-push) 기반, 기기별 구독을 `endpoint` 유니크로 저장하고 만료(404/410) 구독은 발송 중 자동 정리 — 죽은 endpoint를 모아 **단일 `deleteMany({ endpoint: { in: [...] } })`**로 일괄 삭제(건별 쿼리 제거).
- **fire-and-forget 실패 가시화**: 본문 흐름을 막지 않으려 `.catch()`로 흘려보내는 서버 알림·스케줄러(`comment-actions`·`report-actions`·`follows`·`scheduled`·`push:cleanup`)는 침묵 대신 `lib/log.ts swallow(tag)`로 컨테이너 로그에 **태그 + 메시지 한 줄**만 남김(스택 미포함 — 512MB 로그 절약, 디버깅 가시성 확보).
- **인앱 알림 센터**: 댓글→피드 주인, 답글→부모 댓글 작성자에게 알림 생성. 진입 시 자동 읽음 처리, 알림 클릭 시 `?c={commentId}`로 **해당 댓글 스크롤·하이라이트**(답글이면 부모 스레드 자동 펼침). 이후 사용자 작성 게시물로 "주인" 개념을 일반화할 선수 작업.
- **@멘션 알림**: 댓글 본문의 `@닉네임`으로 멘션된 **승인 회원**에게 인앱+푸시. 닉네임이 **DB 유일 제약 없음 + 공백·구두점 허용**이라 정규식 파싱 대신 **승인 회원을 순회하며 `content`에 `@<닉네임>` 포함 여부로 매칭**(공백 닉네임·한국어 접미 견고; 본인·미멘션·`notifyOnMention` off·비승인 제외). 표시에선 `@토큰`을 색 강조(닉네임 비유일이라 링크는 생략). 멘션 팬아웃은 대상이 여럿이라 **배치**로 처리 — 인앱은 `createMany`+`groupBy`(미읽음 일괄 집계), 푸시는 `pushSubscription … userId in [...]` 한 번 조회 후 병렬 전송이라 **대상 수와 무관하게 상수 쿼리**(N+1 제거).
- **회원 팔로우 + 활동 피드**: 회원이 다른 **승인 회원**을 팔로우(자기참조 조인 `Follow(followerId, followingId)` — unique + 양방향 인덱스, 자기 자신·관리자·미승인 대상 거부). `/following`은 팔로우한 회원들의 글을 `authorId in [...]` 단일 쿼리로 최신순 모아보며 **`listableVisibilities(role)` 게이트**로 비공개·숨김·초안·비팔로우 글을 차단(한 쿼리라 팔로잉 수와 무관). 프로필엔 팔로워/팔로잉 카운트 + 낙관 토글 `FollowButton`(`aria-pressed`). 팔로우 시 대상에게 인앱+푸시 알림(`notifyFollow`, `notifyOnFollow` 존중 — 기존 알림 패턴 동형, 신규 생성 시에만).
- **알림 환경설정**: 회원이 종류별(답글·내 글 댓글·**멘션**·**팔로우**)로 수신 on/off(`User.notifyOnReply/notifyOnComment/notifyOnMention/notifyOnFollow`). 이벤트 단위 제어라 off면 **인앱·푸시 모두 미생성**(notify 함수가 수신자 설정을 확인 후 스킵). 기기별 푸시 구독(`PushToggle`)과 직교 — 한쪽은 "어떤 이벤트로", 다른 쪽은 "이 기기로". 진입은 **알림 센터(`/notifications`)에 있을 때 헤더 종이 설정 톱니바퀴로 전환**(미읽음이 0으로 처리된 페이지라 배지가 무의미 → 설정 진입으로 대체, 회원 한정·관리자는 종 유지).
- **실시간 알림(SSE)**: 헤더 벨 배지를 **서버센트 이벤트**로 실시간 갱신(웹 푸시는 닫힌 탭용, SSE는 열린 탭용 — 상보). 단일 컨테이너라 **인메모리 채널 버스**(`lib/events.ts`, rate-limit Map과 동형)에 `createNotification`/`markAllRead`이 미읽음 수를 publish하고, `/api/events` 라우트가 `ReadableStream`으로 구독자에게 전달. nginx **무수정**(응답 `X-Accel-Buffering: no` + 25초 하트비트로 버퍼링·idle 타임아웃 회피), 연결 종료(`req.signal` abort/cancel) 시 구독·인터벌 정리로 누수 방지. EventSource 자동 재연결 + 연결 시 현재 카운트 재전송으로 resync.
- **실시간 댓글(SSE)**: 같은 버스의 `feed:{id}` 채널로 확장. 댓글 작성·삭제 서버 액션이 `CommentEvent`(생성 노드/삭제 id)를 publish하고, `/api/feed-events` 라우트가 **글 상세와 동일한 접근 게이트**(`checkAccess`+초안·숨김 차단, 공개 글은 anon도 구독)로 전달. 클라이언트는 낙관적 삽입과 **동일한 순수 병합 함수**(`merge.ts`의 `applyCreated`/`applyEdited`/`applyDeleted`/`applyLikeCount`)로 트리에 반영하며, **id 기반 dedup**으로 본인 낙관적 삽입·SSE 에코·`loadMore` 재등장 중복을 흡수(원격 이벤트는 스크롤 없음). **댓글·글(게시물) 좋아요 수도 같은 채널로 실시간** 반영(연타는 ~500ms 디바운스로 1요청). 좋아요 버튼은 댓글 트리 밖 형제라, `feed:{id}` 채널의 **단일 EventSource를 클라이언트 provider(`FeedEventsProvider`)로 공유**해 댓글 섹션·좋아요 버튼이 연결 1개를 나눠 쓴다(공개 글 익명 뷰어의 연결 중복 방지). 채널은 `FeedEvent`(댓글 이벤트 ∪ `feedLike`) union을 나르고 각 소비자가 `kind`로 분기. 연결이 끊긴 동안(배포 재시작·네트워크 드롭) 발생한 이벤트는 라이브로 못 받지만, **재접속(EventSource `onopen` 재발생) 시 provider가 `resync` 신호를 팬아웃**해 댓글 섹션은 현재 로드량만큼 페이지를, 좋아요 버튼은 요약을 다시 받아 권위 상태로 교체한다(unread 벨이 connect 시 현재값을 재전송하는 것과 동형의 재동기화).

### 4.8 전역 요청 속도 제한 (어뷰징 방지)

전반적 요청 폭주를 막기 위해 `proxy.ts`에서 IP당 고정 윈도우 카운터(120req/10s 초과 시 429)를 적용.

- Next 16 proxy가 **Node 런타임**으로 동작함을 문서로 확인 → 단일 인스턴스(`next start`) 프로세스에서 인메모리 `Map` 상태가 유지되어 외부 스토어 없이 신뢰성 확보.
- **버킷 하드 캡(메모리 안전밸브)**: 60초 주기 만료 스윕 외에 `MAX_BUCKETS`(5만) 상한을 둬, 고유 키(IP·userId)가 한 윈도우에 폭주(사실상 공격)해도 `Map`이 무한히 자라 OOM(단일 512MB 컨테이너)에 이르지 않게 함 — 만료 스윕 후에도 초과면 `clear()`로 일괄 비움(한도 일시 리셋보다 메모리 보호 우선).
- matcher를 동적 요청 전반으로 확장하되 정적 자산·이미지·업로드는 제외해 정상 트래픽(프리페치·이미지)이 한도를 깎지 않도록 조정.
- 사람/봇 구분이 필요한 **가입·로그인·비밀번호 재설정 요청**엔 선택적 **Cloudflare Turnstile CAPTCHA**를 더해 서버 액션에서 토큰을 검증. 시크릿 미설정 시 위젯 미노출·검증 통과로 **완전 비활성**(SMTP·TOTP와 동일한 graceful degradation). 토큰 단일 사용이라 검증 실패 시 위젯을 리셋.
- **민감 액션별 제한**: 전역 한도(초당 12)로는 느슨한 표적 공격(로그인 브루트포스·가입 스팸·코드 남발·신고 남용)을 막기 위해 같은 `rateLimit` 유틸을 액션 단위로 재사용(`allowAction(scope, id)`). 비로그인 액션은 **IP 키**(로그인 10/5분·가입 5/10분·코드요청 5/10분), 신고는 **회원 userId 키**(10/10분). turnstile **앞에서** 싸게 차단하므로 캡차 비활성 환경에서도 동작하고, 캡차가 켜져도 심층 방어. (코드요청의 이메일당 60s 쿨다운·신고의 `(대상,회원)` 유니크 제약은 별개로 유지.)

### 4.9 점검(maintenance) 모드

관리자가 공개 사이트를 외부 방문자에게 on/off 하는 기능. 싱글톤 설정 테이블 + 가드 유틸로 구현.

- 가드를 페이지가 아닌 **레이아웃**에 두어 `loading.tsx`의 Suspense 경계보다 먼저 실행 → 점검 중 비어드민을 **스켈레톤 깜빡임 없이 깔끔한 307**로 `/maintenance` 리다이렉트.
- 무한스크롤 Server Action에도 동일 가드를 적용해 데이터 노출 차단.

### 4.10 피드 검색 + 무한스크롤

제목·본문·요약 검색과 10개 단위 무한스크롤을 결합. 검색어가 3자 이상이면 **SQLite FTS5 전문 검색**, 그 외(빈 검색·2자)는 부분일치 최신순.

- **FTS5 전문 검색**: `feed_fts` 가상 테이블(**external content**로 본문 중복 저장 회피, "Feed"의 rowid 공유)을 **trigram 토크나이저**로 색인 — 한국어/CJK 부분일치(예: "물고기"가 "강아지물고기"에 매치)를 LIKE처럼 보존하면서 역색인으로 검색. `AFTER INSERT/UPDATE/DELETE` 트리거가 Feed 변경을 자동 동기화(앱 코드 무변경), 마이그레이션에서 기존 데이터 백필. 가상테이블·트리거는 Prisma 모델로 표현 불가라 **schema.prisma 밖 raw SQL**(`migrate dev --create-only` 후 수동 작성, 배포는 `migrate deploy`; 테스트 DB는 `lib/test-db.ts` SCHEMA에 동일 DDL 동기화).
- **관련도 랭킹·쿼리 결합**: `bm25(feed_fts, 10,5,1)`로 제목>요약>본문 가중 정렬. 검색은 **FTS로 랭킹된 Feed.id 후보만** 얻고, 접근 제어·author·tag 필터와 SELECT는 기존 Prisma 경로를 그대로 재사용(DRY) — id 후보는 비민감, 실데이터는 2단계 Prisma가 게이트. 다중 토큰은 AND(모두 포함), FTS 연산자/따옴표는 phrase 이스케이프 + `?` 바인딩으로 안전. 3자 미만 토큰은 trigram 미적격이라 contains 폴백.
- `take+1`(폴백)·후보 슬라이스(FTS)로 추가 count 쿼리 없이 다음 페이지 존재 여부 판단.
- 검색은 300ms 디바운스, **요청 시퀀스(reqId)로 빠른 타이핑 시 늦게 온 응답을 폐기**해 레이스 컨디션 방지. `?q=` URL 동기화로 결과 공유 가능.
- **스니펫·하이라이트**: 검색 시 결과 카드에 summary 대신 **매치 중심 본문 발췌**를 표시(`makeSnippet` — 마크다운 제거 후 첫 매치 토큰 ±radius 윈도우, 잘리면 `…`). 본문(content)은 목록 SELECT에 없어 **페이지 슬라이스 id로만 1쿼리** 추가 조회(비검색·저장목록은 미조회). 제목·발췌의 검색 토큰은 `<mark>`로 강조하되 **문자열을 분할해 매치 조각만 엘리먼트로 감싸**(정규식 특수문자 이스케이프) HTML 주입 없이 XSS 안전.
- **관련 글 추천**: 글 상세 하단에 같은 태그를 공유하는 글을 추천(`getRelatedFeeds`). `feedTags.some` + `listableVisibilities(role)`(검색과 동일 접근 게이트)로 후보를 뽑고 **공유 태그 수 → 최신** 순으로 재정렬(self·비공개/숨김/초안 제외, 태그 없으면 미표시).
- **관리자 피드 검색**: `/admin/feeds`는 공개용 FTS(`status=published` 고정·`hasMore` 반환)와 달리 **초안 포함·전체개수 페이지네이션**이 필요해, `getAdminFeedsPage(page,size,q)`에 **제목·슬러그 contains** 필터를 더한 서버렌더 GET 폼으로 구현. `Pager`는 `query` prop으로 페이지 이동 시 `?q=`를 보존. 공개 FTS 재사용 대신 가벼운 contains로 초안 가시성·total 일관성 유지.
- **커뮤니티 검색 필터 바**: `/community`(회원 글)에 **정렬 토글(최신/인기) + 인기 태그 칩**을 추가. 정렬은 `searchFeeds`에 `sort?: "latest" | "popular"`를 더해 — **미전달 시 현행 동작 유지**(FTS 관련도순·그 외 최신순 → `/feed`·기존 테스트 무영향), `popular`은 `viewCount desc`(인기글 랭킹과 동형, FTS 경로는 rank 대신 정렬키로 재정렬). `q`가 클라이언트 상태(디바운스+`replaceState`)라 정렬도 클라 상태로 묶어 함께 재조회하고, 토글은 댓글 정렬과 동형 세그먼트(`role="group"`/`aria-current`)이며 `showSort` prop으로 커뮤니티에만 노출. 태그 칩은 `getTagsWithCounts(role, {author:"member", limit})`(작성자 스코프 확장)로 회원 글 인기 태그를 뽑아 `?tag=` 서버 링크로 제공(활성 칩 `aria-current`·해제 링크).
- **시리즈/컬렉션**: 관리자 글을 순서 있는 시리즈로 묶어 `/series` 인덱스·`/series/[slug]` 페이지·글 상세 시리즈 박스("N편 중 K번째 + 시리즈 내 이전/다음")를 제공. `Feed.seriesId`+`seriesOrder`(다대일, 삭제 시 글 보존 SetNull) + `Series`. 시리즈 자체엔 visibility가 없고 **포함 글의 가시성에서 파생**(`getSeriesWithCounts`는 뷰어 가시 글이 있는 시리즈만, `getSeriesPosts`/`getSeriesContext`는 `listableVisibilities(role)` 필터, 비공개 전용 시리즈는 비관리자에 404). 멤버십은 feed-form `시리즈` select로 지정, 순서는 시리즈 편집 페이지의 **@dnd-kit 드래그 재정렬**(`reorderSeries` 트랜잭션, 던파 쇼케이스와 동형). 카드 렌더·인덱스·CRUD는 `toFeedCard`/태그 인덱스/admin 액션 패턴 재사용. **시리즈별 RSS**(`/series/[slug]/rss.xml`)로 시리즈 단위 구독 제공 — 전체 글 RSS(`/rss.xml`)와 **순수 빌더(`lib/rss.ts renderRssFeed`)를 공유**(채널/아이템 XML·이스케이프 1곳), 피드 리더가 비로그인이라 `getSeriesPosts(id,"anon")`의 **공개 글만** 시리즈 순서로 싣고, 없는 슬러그·공개 글 0개 시리즈는 404(시리즈 페이지 은닉과 일관). 시리즈 페이지 `<head>`의 `alternate` 링크 + 헤더 RSS 링크로 발견성 노출.

### 4.11 테스트 전략

DB 로직은 prisma 호출을 mock하면 동어반복이 되므로, **임시 SQLite에 실제 쿼리를 돌려** 검증하는 통합 테스트 헬퍼(`lib/test-db.ts`)를 만들어 페이지네이션·검색·접근 제어·승인 흐름·댓글 깊이·좋아요·알림·속도 제한·신고까지 커버. 인증 계층도 가드: **JWT 위조 거부**(다른 시크릿·변조 토큰), **세션/리셋 쿠키**(`next/headers` 모킹), **DAL 인가**(역할·승인·`verifySession` 리다이렉트 — `React cache()`는 시나리오별 `resetModules`+재import로 우회), **인증 서버액션**(signin·signup·forgot-password 3단계 — 의존성 모킹, `redirect()`의 `NEXT_REDIRECT` throw 단언). **핵심 클라이언트 컴포넌트는 RTL(jsdom)**로도 검증 — 댓글 트리 병합 순수 로직(`merge`: 생성·수정·삭제·좋아요·dedup), 댓글 항목(작성자 링크·수정/삭제 권한·편집 흐름), 공유 바(클립보드·기기공유·X 인텐트), 내비 드로어(역할별 메뉴·`aria-expanded`·`inert`·Esc), 댓글 섹션 SSE 배선(가짜 이벤트 emit → 트리 갱신). 서버 액션·EventSource·toast는 `vi.mock`/주입으로 격리. 전체 **17 → 578 테스트**로 확장.

### 4.12 콘텐츠 신고·모더레이션

회원 콘텐츠(댓글·회원 글)에 대한 신고와 관리자 모더레이션을 추가.

- **신고 적재**: `Report(targetType,targetId,reporterId,reason,detail,status)`에 `@@unique([targetType,targetId,reporterId])`로 **회원당 대상 1회**. 서버에서 본인·관리자 콘텐츠·이미 숨김 대상을 거부하고, SQLite는 `createMany.skipDuplicates`를 지원하지 않아 **unique 충돌(P2002) catch로 중복 dedupe**. 새 대상의 첫 신고에만 예약 관리자에게 인앱+푸시 알림(브리게이딩 스팸 완화).
- **복구 가능한 숨김**: 사용자 삭제(`deletedAt`)와 별개의 `hiddenAt`(Comment·Feed)으로 모더레이션 숨김을 표현. 숨김 시 해당 대상의 pending 신고를 `resolved`로. 숨김 콘텐츠는 **목록(searchFeeds)·프로필(listMemberPosts·getCommentsByUser)·상세(관리자만 열람)·댓글 트리(본문 비움)** 모든 소비처에서 가려지고, 관리자가 언제든 복구.
- **관리자 큐**(`/admin/reports`): "대기 중"/"가려진 콘텐츠" **하위 탭**으로 분리. 대상별로 신고를 묶어 신고 수·사유·미리보기를 보여주고 숨김/기각, 가려진 콘텐츠 목록에서 숨김 해제. 미처리 수는 관리자 내비 배지로 — **SSE(`reports` 채널)로 새 신고·처리 시 새로고침 없이 라이브 갱신**.

### 4.13 관리자 통계 대시보드

`/admin/stats`에 조회수 추이·가입 추이·인기글·요약 수치를 추가(차트 라이브러리 없이 CSS 막대).

- **KST 정합 집계**: `View.day`는 이미 KST `YYYY-MM-DD` **문자열**이라 `view.groupBy(by:["day"])`로 일별 조회 집계가 raw 없이 된다(사전순=시간순). 반면 `User.createdAt`은 `DateTime`이라 일별 가입은 **raw SQL `date(createdAt, '+9 hours')`** 로 KST 일자를 뽑는다(Prisma `groupBy`는 타임스탬프를 초 단위로 쪼개 불가). 두 추이 모두 최근 N일 KST 윈도우를 만들어 **빈 날을 0으로 채워** 정렬.
- 인기글은 누적 `Feed.viewCount desc`(이미 조회 1건=고유 View row와 일치). 접근은 `/admin` 레이아웃의 `verifySession()` 상속. 막대는 라벨·수치를 실제 텍스트로 두고 바는 `aria-hidden` 장식이라 스크린리더 접근 가능.

### 4.14 에러 바운더리 (회복 가능한 실패 처리)

렌더 중 던져진 예외가 빈 화면/프레임워크 기본 화면으로 새지 않도록 App Router 에러 바운더리를 도입.

- **`app/error.tsx`**(루트 세그먼트): 더 가까운 바운더리가 없는 모든 페이지의 렌더 예외를 잡아 한국어 폴백 + **다시 시도**(`unstable_retry`)로 회복. 루트 레이아웃 안쪽에서 렌더돼 헤더는 유지.
- **`app/global-error.tsx`**: 루트 레이아웃 자체(세션·알림 DB 호출 등)가 던지는 치명 예외의 최종 폴백 — 루트 레이아웃을 대체하므로 자체 `<html>/<body>` + `globals.css`를 렌더.
- 두 바운더리는 공유 폴백(`app/error-fallback.tsx`)으로 DRY. `<main>` 랜드마크·단일 `h1` 유지하고 메시지 영역만 `role="alert"`로 announce, 홈 링크는 라우터 트리가 끊긴 컨텍스트에서도 동작하도록 순수 `<a>`(하드 내비). 이 Next 버전은 회복 prop이 `reset`이 아니라 **`unstable_retry`**.

### 4.15 HTTP 보안 헤더 (CSP 등)

`next.config.ts`의 `headers()`로 전 경로에 보안 헤더를 적용(헤더 빌더는 `next.config.ts`에 인라인하고 named export로 테스트와 공유 — 런타임 이미지가 `lib/`를 복사하지 않아 config가 lib을 import하면 기동이 깨지기 때문).

- **헤더**: `Content-Security-Policy` + `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy`(카메라·마이크·위치 차단) · `Strict-Transport-Security`(prod 한정).
- **CSP 방식 선택**: nonce는 이 Next 버전에서 **전 페이지 동적 렌더를 강제**(정적 최적화·캐싱 포기)하므로 채택하지 않고, `script/style`은 `'unsafe-inline'`을 허용하되 **외부 스크립트 출처를 화이트리스트**(Turnstile `challenges.cloudflare.com`, Kakao SDK `t1.kakaocdn.net`)로 제한하고 `frame-ancestors 'none'`·`object-src 'none'`·`base-uri 'self'`·`form-action 'self'`로 클릭재킹·인젝션 표면을 차단. 외부 https 이미지(본문·Neople)는 `img-src https:`로 허용, 폰트는 `next/font` self-host라 `font-src 'self'`. `upgrade-insecure-requests`·HSTS는 prod에만(로컬 http 깨짐 방지). 사용자 콘텐츠는 react-markdown이 raw HTML을 렌더하지 않아 잔여 인젝션 위험이 낮다.

### 4.16 SEO 구조화 데이터 (JSON-LD)

글 상세에 **schema.org JSON-LD**(`BlogPosting` + `BreadcrumbList`)와 명시적 **canonical**을 추가해 검색 리치 스니펫(작성자·발행/수정일·breadcrumb)을 노출.

- **빌더 분리**: `lib/structured-data.ts`(순수)가 `@graph`로 BlogPosting+Breadcrumb를 만들고 기존 `absoluteUrl`·`isoInstant`를 재사용. `datePublished=publishedAt ?? createdAt`, `dateModified=updatedAt`, 작성자는 회원이면 `Person`+`/u/{id}` URL·관리자면 이름만, `image`는 동적 OG 라우트, `publisher`는 사이트 Organization+로고.
- **게이팅**: **전체공개·게시 글만** JSON-LD 주입(OG 이미지와 동일 — 회원공개/비공개/초안은 미노출로 게이트 콘텐츠가 구조화 데이터로 새지 않음). canonical은 열람 가능한 글에 설정해 `?c=`·`?sort=` 쿼리 중복 인덱싱 방지.
- **안전 주입**: `dangerouslySetInnerHTML`로 인라인하되 직렬화 시 `<`를 `<`로 이스케이프해 제목/요약의 `</script>`가 마크업을 깨거나 주입되지 않게 함(CSP `script-src 'unsafe-inline'`라 nonce 불필요).
- **홈 사이트 식별**: 홈(`/`)엔 `buildSiteJsonLd()`로 **`WebSite` + `Organization`** `@graph`를 1회 주입(`@id`로 상호 참조). `WebSite.potentialAction`의 **`SearchAction`**(target `/feed?q={search_term_string}` — 기존 공개 검색 라우트)으로 구글 사이트링크 검색창 후보를 제공. 사이트명·설명은 `lib/share.ts` 공용 상수(`SITE_NAME`/`SITE_DESCRIPTION`)에서 가져와 글 상세 publisher와 일치시킴.

### 4.17 발견성 페이지 (인기 글·태그 인덱스)

쌓이던 조회수·태그를 공개적으로 탐색하게 하는 두 페이지(`/feed/popular`·`/feed/tags`)를 `app/feed/` 아래 두어 점검 모드 가드를 상속.

- **인기 글**: `getPublicTopFeeds(role)`가 누적 조회수순으로 게시·미숨김 글을 **뷰어 가시 범위**(`listableVisibilities`)로 반환 — admin 전용 `getTopFeeds`와 달리 visibility를 필터해 공개 노출에 안전. 카드 UI는 `FeedCardItem` 재사용.
- **태그 인덱스**: `getTagsWithCounts(role)`가 `feedTag.groupBy` + 관계 `where`(가시 글)로 글 수를 집계해, **가시 글이 1개 이상인 태그만** 글 수와 함께 내림차순 반환(비공개/숨김 전용 태그는 빈 링크가 되지 않게 제외).
- **태그 전용 라우트** `/feed/tags/[slug]`: 기존 `?tag=` 쿼리 필터 대신 **태그별 canonical URL + `CollectionPage`/`ItemList`/`BreadcrumbList` JSON-LD**(`buildTagJsonLd`)를 가진 SSR 라우트. `getFeedsByTag(slug, role)`가 해당 태그·뷰어 가시 글(관리자+회원)을 최신순 반환(태그 인덱스와 동일 범위라 클릭 시 404 없음; 가시 글 0 && 비admin → 404로 비공개 전용 태그 은닉), 카드·구조화 데이터 모두 `listableVisibilities(role)` 가시분만 노출. 태그 칩(카드·인덱스)을 이 라우트로 모아 내부 링크 집중, sitemap에 전체공개 태그 페이지 추가. `?tag=`는 하위호환 유지. **슬러그 정규화**: Next는 동적 `[slug]` 파라미터를 **URL 디코딩하지 않고** 넘기므로(한글은 퍼센트 인코딩 상태로 도착), 조회 측(`tagSlugVariants`)에서 **디코딩 + NFC·NFD 변형 매칭**을 수행 — 한글 태그가 404 나던 회귀를 마이그레이션 없이 해소. 저장 시 `slugifyTag`가 NFC로 통일해 신규 태그를 정규화하고, NFD(자모 분해형, macOS 입력 등)로 저장된 레거시 슬러그도 두 형태 매칭으로 함께 찾는다. **태그 OG 이미지**: 태그 페이지도 colocate된 `opengraph-image.tsx`로 동적 OG 카드(`#태그명` + 공개 글 수)를 생성 — 글 OG와 **공유 빌더 `lib/og.tsx ogImage(title, subtitle)`**(Pretendard·1200×630) 재사용, 글 수는 `countFeedsByTag(slug,"anon")`로 **공개 기준**(글 OG의 공개 게이팅과 동형), 없는 태그·공개 글 0개 태그는 기본 브랜드 카드로 폴백.
- **프로필 댓글 딥링크**: `/u/[id]` 최근 댓글 클릭 시 `/feed/{slug}?c={commentId}`로 이동해 해당 댓글/대댓글로 스크롤·하이라이트(알림 딥링크와 동일 메커니즘 — `comment-item`이 대댓글이면 부모 스레드 자동 펼침).
- 진입은 nav 드로어·홈 둘러보기 카드·sitemap(전체공개 관리자 글이 있는 개별 태그 URL 포함)에 추가.

### 4.18 DB 자동 백업

`/data/prod.db`(WAL) 손상·실수 삭제·잘못된 마이그레이션에 대비한 **자격증명 없는 로컬 백업**.

- **스크립트**(`scripts/backup-db.sh`): sqlite **온라인 `.backup`**(쓰기 중에도 일관된 스냅샷, WAL 반영) → gzip → `find -mtime`으로 N일(`BACKUP_KEEP_DAYS`, 기본 14) 회전. 런타임 이미지에 `sqlite3` CLI를 추가하고 스크립트를 베이크(앱 의존성 그래프 무변경 — `next.config`의 lib import가 일으킨 502 교훈 반영해 self-contained 셸만).
- **스케줄**(`.github/workflows/backup.yml`): 매일 04:00 KST + 수동(`workflow_dispatch`). 기존 배포와 **동일 SSH 시크릿**으로 호스트에 접속해 `docker compose exec -T web sh scripts/backup-db.sh` 실행 — 상시 사이드카 없이(512MB 인스턴스 RAM 절약) 정확한 일정.
- 복원 가능성은 테스트로 가드(백업본 gunzip 후 `PRAGMA integrity_check`=ok·행 보존, 회전 동작). 오프사이트(인스턴스 유실 대비 R2/B2)는 후속 과제.

### 4.19 읽기 경험 (이전/다음 글·진행바·맨 위로)

글 상세에 가벼운 읽기 보조 3종을 추가.

- **이전/다음 글**: `getAdjacentFeeds(feed, role)`가 시간순 인접 글 1건씩을 뷰어 가시 범위 + **같은 작성자 분류**(관리자 글↔관리자 글, 회원 글↔회원 글)로 조회 — 독자가 보던 컬렉션을 벗어나지 않게. 본문 푸터에 `RelatedFeeds` 스타일로 렌더(둘 다 없으면 미표시).
- **읽기 진행바**(`reading-progress-bar`): 뷰포트 상단 고정 바가 문서 스크롤 진행률 표시. passive 스크롤 + `requestAnimationFrame` 스로틀, 장식이라 `aria-hidden`.
- **맨 위로**(`back-to-top-button`): 임계 스크롤 초과 시 우하단에 등장(미표시 땐 DOM 미렌더 → 포커스 제외), 클릭 시 최상단으로.
- **모션·포커스 a11y**: CSS 트랜지션·애니메이션·`scroll-behavior`는 `globals.css`의 `@media (prefers-reduced-motion: reduce)`가 중화하지만, **JS 스무스 스크롤은 미디어쿼리로 못 막으므로** 공용 `prefersReducedMotion()`(`lib/motion`)로 호출부에서 분기 — 맨 위로·댓글 알림 딥링크 스크롤이 동작 줄이기 선호 시 즉시 점프. 폼 입력의 box-shadow 포커스 링에 더해 **버튼·링크·summary에도 일관된 `:focus-visible` outline 링**을 전역 추가(브라우저 기본 대체, currentColor 기반 테마 정합).

### 4.20 코드 신택스 하이라이팅

마크다운 본문·미리보기 공유 렌더러(`MarkdownContent`)에 `rehype-highlight`(highlight.js)를 추가. **글 상세는 서버 컴포넌트라 하이라이트가 서버 렌더 시 1회 수행** → 공개 독자에겐 추가 클라이언트 JS 0(정적 HTML에 `hljs` 클래스). shiki 대신 highlight.js를 택해 번들·이미지 슬림화 기조 유지. 토큰 색은 단일 고정 테마 CSS 대신 `globals.css`에 **3테마(light/dark/brand) 정합**으로 직접 정의하고, 펜스 코드블록은 가로 스크롤·`font-mono`로, 인라인 code 배경이 블록에 새지 않게 `pre code`를 무력화. raw HTML 비허용은 그대로라 XSS 안전.

### 4.21 초안 자동저장 (localStorage, 누적/용량 안전)

작성 에디터(회원·관리자)에 새로고침·실수 이탈 시 작업 유실을 막는 localStorage 자동저장을 추가. 핵심은 **누적·용량 폭주를 막는 안전 스토어**(`lib/draft-store.ts`)다.

- **안전장치**: 글당 키 1개(`byjang-draft:<scope>:<id|new>`)로 **overwrite(append 아님)** → 항목 무한증식 방지. 저장본에 `savedAt`을 남겨 **7일 TTL**, 개수 상한(12)·만료를 마운트 시 `pruneDrafts()`로 스윕. 직렬화 길이 캡(1M 코드유닛) 초과는 스킵. `setItem`이 `QuotaExceededError`로 던지면 **정리 후 1회 재시도, 그래도 실패면 조용히 포기** — 자동저장은 best-effort라 타이핑·제출을 절대 막지 않음(`typeof window` 가드 + 전 구간 try/catch).
- **두 에디터**: 회원 에디터는 controlled state라 값으로 저장/복원, 관리자 폼은 uncontrolled라 `form onInput`으로 `FormData`를 읽어 저장하고 복원 시 `elements.namedItem`으로 값을 채움(이미지 삽입 후엔 합성 `input` 이벤트로 자동저장이 잡게). 저장본이 초기값과 다를 때만 `DraftRestoreBanner`로 **복원/무시**를 제안(자동 덮어쓰기 안 함).
- **수명주기**: 제출 시 키 삭제(성공은 리다이렉트로 종료). 검증 실패로 리다이렉트가 없으면 `state` 변화 effect가 현재 값을 **재저장**해 데이터 유실 창을 닫음.
- **댓글 박스**: 최상위 댓글 입력도 같은 `draft-store`로 자동저장(키 `member:comment:<feedId>`, 디바운스 600ms). 댓글은 짧아 배너 없이 마운트 시 **조용히 복원**, 제출 성공 시 삭제(답글 폼은 일시적이라 제외).

### 4.22 이미지 CLS 방지 + lazy-load

본문 이미지가 치수 없이 렌더돼 로드 시 레이아웃이 밀리던(CLS) 문제를 제거. nginx가 `/uploads/*`를 직접 서빙해 `next/image`가 부적합하므로 **plain `<img>` + 치수 속성**으로 해결.

- **업로드 시 치수 측정**: `uploadImage`가 버퍼를 `image-size`(헤더만 파싱)로 읽어 삽입 마크다운 URL에 `?w=&h=`를 실음(`lib/image-size.ts`는 `server-only` — `lib/upload.ts`가 클라에서도 쓰이므로 격리). 손상·미지원은 null → 쿼리만 생략(업로드는 계속).
- **렌더**: `MarkdownContent`의 커스텀 `img`가 src 쿼리에서 w/h를 파싱해 `width/height`를 부여 → 브라우저가 종횡비로 공간을 예약(시프트 0), `[&_img]:h-auto`로 반응형 유지. 모든 본문 이미지에 `loading="lazy" decoding="async"`. 쿼리 없는 외부 이미지는 lazy만. 쿼리는 nginx·dev 라우트가 무시(파일 그대로 서빙).

### 4.23 예약 발행

관리자가 **글 생성 시에만** 미래 발행 시각을 지정하면 그때까지 숨겼다가 자동 게시.

- **모델 재사용**: 예약 글 = `status:"draft"` + 새 `scheduledAt`. draft는 이미 모든 공개 표면(목록·검색·상세(작성자 외)·sitemap·RSS·태그·관련·인기·인접)에서 `status:"published"` 필터로 제외되므로 **공개 쿼리 변경 0건**. 도래 시 `draft→published`로만 뒤집고 `visibility`(작성 시 선택)는 그대로 라이브.
- **발행 트리거(앱 내부 스케줄러)**: 컨테이너(`next start`)가 항상 떠 있으므로 **Next `instrumentation.ts`**가 부팅 시 `startPublishScheduler`를 1회 시작 → **2분 간격**으로 `publishDueFeeds`(`updateMany`로 `status="draft" ∧ scheduledAt≤now` 일괄 게시·`scheduledAt` 비움)를 직접 호출. **외부 cron·시크릿 불필요**(GitHub Actions schedule은 저활동 레포에서 수 시간 지연돼 신뢰 불가 → 제거). 단일 프로세스라 인터벌 1개(globalThis 가드로 중복 방지), `updateMany`라 멱등. **수동 백업**: 같은 로직을 `/api/cron/publish-scheduled`(헤더 `CRON_SECRET` **상수시간 비교**, 미설정 401)로 노출하고 `publish-scheduled.yml`(`workflow_dispatch`)로 즉시 트리거 가능.
- **시각**: 입력은 **react-day-picker**(날짜) + time 입력 → `"YYYY-MM-DDTHH:MM"`(KST 벽시계)를 hidden input으로 제출, `kstWallClockToUtc`로 UTC 변환(브라우저 TZ 무관·달력 오버플로 거부). 과거/무효는 폼 에러. 작성 폼에 **사람이 읽는 미리보기**(`formatKstWallClock` → "6월 23일 (화) 오전 7:23 발행 예정") + **과거 시각 클라 경고**(`server-only`인 `decideSchedule` 대신 `lib/kst`로 판정). **수정 화면엔 예약 컨트롤 미노출**(생성 전용 보장: `updateFeed`는 `scheduledAt` 무시).
- **관리자 운영**: 목록에 "🕒 예약: {시각}" 배지 + **"지금 게시"**(예약 초안 즉시 발행) 안전밸브. 회원 임시저장(`scheduledAt` null)은 영향 없음.

### 4.24 사이트 내 게임 (`/play`)

블로그에 새 장르로 게임을 단계적으로 구현하며 일관되게 **로직/렌더 분리**(게임 규칙은 순수 함수 → 단위 테스트, 렌더는 그 상태를 그리기만)를 적용한다. 첫 시도였던 **three.js 턴제 SRPG**(에테르 택틱스)는 S1~S4까지 구현했으나 콘텐츠 의존이 큰 장르라 취미 규모에 안 맞아 중단·아카이브(`docs/games/archive/srpg-design.md`), `three` 의존과 `app/play/`·`lib/game/srpg/` 코드는 제거(git 이력 보존). 현재는 더 가벼운 **로그라이크 텍스트 RPG**(`docs/games/text-rpg-design.md`)로 피벗 — 순수 엔진 + 절차생성 + 시드 결정론으로 콘텐츠를 자동 확보하고 회원 리더보드(Prisma)를 둔다. **S1(순수 엔진) 완료**: `lib/game/rogue/`에 시드 PRNG(mulberry32)·플레이어/성장·적/깊이 스케일·전투·아이템·이벤트·던전·**단일 리듀서**(`run.ts`)·점수를 three/DOM/DB 의존 0의 순수 함수로 구현 → jsdom/Vitest 단위 테스트(34건, 같은 시드+같은 액션열 = 동일 상태 결정론 포함). **S2(텍스트 UI) 완료**: `/play`(승인 회원·관리자 접근 — 비회원은 `MemberGate`)에서 엔진을 얇은 React로 렌더. 순수 뷰모델(`app/play/view.ts` — `hudView`/`actionsFor`, 단위 테스트)이 상태→HUD 요약·상황별 액션 버튼을 계산하고, 클라이언트 셸은 `useState`+`reduce`로 한 런을 보유. **접근성**: 모험 로그는 `role="log"`+`aria-live="polite"`, 사망은 `role="alert"`, HP는 `role="progressbar"`+텍스트, 액션은 시맨틱 `<button>`에 **숫자 단축키·Enter(기본 행동)** 키보드 전조작. 시드는 서버 랜덤(비순수·하이드레이션 불일치)을 피해 **클라이언트 마운트 후 1회** 생성하고, 시드 입력으로 같은 던전 재도전(결정론). **S3(콘텐츠/밸런스) 완료**: 순수·결정론을 유지한 채 콘텐츠를 확장 — 적 로스터 8종 + **깊이 게이팅**(`minDepth`로 깊을수록 강적 해금)·보스 3종 **층 순환**(같은 깊이=같은 보스), 무기/방어구 **5티어** + 큰 체력 물약(깊이 4↑ 등장), 휴식 세부 결과(일반/모닥불 전체회복/약초→물약)·함정 세부 결과(피해/골드 상실)를 가중 추첨으로 분기, 층 분위기 텍스트 순환. 이벤트 종류·`shopStock` 시그니처를 보존해 UI·기존 테스트와 호환(엔진 단위 테스트만 확장). 다음은 S4(영속·리더보드).

## 5. 성과 요약

- 런타임 이미지 **2.05GB → 876MB (−57%)**, 배포 첫 pull **10분 32초 → 37초**
- 운영 장애(디스크 고갈·OOM) 원인 규명 및 해소 → 배포 성공률·안정성 확보
- Prisma 7 드라이버 어댑터 도입으로 런타임 엔진 바이너리 제거
- 단일 관리자 → 가입·승인 회원 + 댓글·좋아요·알림·신고·모더레이션·PWA로 커뮤니티 기능 확장(역할 유니온 세션·공용 접근 제어)
- 통합 테스트 도입(17 → 578), CI에서 타입체크·린트·테스트·이미지 빌드 게이트
- 기능 단위 PR + 자동 배포 + pre-1.0 semver 버전 관리로 변경 이력 정리
