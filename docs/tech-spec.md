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
방문자/회원 ─ HTTPS(HTTP/2) ─> nginx ──┬─ /uploads/*  → 디스크 볼륨에서 직접 서빙(정적)
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
| 프레임워크 | Next.js (App Router)            | 16.4.5     | Server Actions·RSC로 API 레이어 없이 데이터 변경 처리                  |
| UI         | React / Tailwind CSS            | 19.3 / v4  | —                                                                      |
| ORM/DB     | Prisma / SQLite                 | 7.10 / —   | 드라이버 어댑터(better-sqlite3 12.10)로 런타임 쿼리 엔진 바이너리 제거 |
| 인증       | jose (JWT)                      | 6.2        | 미들웨어에서도 검증 가능한 경량 서명                                   |
| 콘텐츠     | react-markdown + remark-gfm     | 10.1 / 4.0 | 본문 마크다운 렌더                                                     |
| 검증       | zod                             | 4.6        | 폼·업로드 입력 검증                                                    |
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
- **CI 위생 게이트**: test 잡이 `tsc → eslint → prettier --check → vitest → pnpm audit(--prod --audit-level moderate)`를 통과해야 빌드·배포로 진행. 포맷·**moderate 이상 런타임 취약점** 회귀를 머지 전 차단(취약점 0건 달성 후 critical → moderate로 강화. dev 의존성은 배포 산출물에 없어 게이트 제외, Dependabot이 처리).
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
- **실시간 알림(SSE)**: 헤더 벨 배지를 **서버센트 이벤트**로 실시간 갱신(웹 푸시는 닫힌 탭용, SSE는 열린 탭용 — 상보). 단일 컨테이너라 **인메모리 채널 버스**(`lib/events.ts`, rate-limit Map과 동형)에 `createNotification`/`markAllRead`이 미읽음 수를 publish하고, `/api/events` 라우트가 `ReadableStream`으로 구독자에게 전달. nginx **무수정**(응답 `X-Accel-Buffering: no` + 25초 하트비트로 버퍼링·idle 타임아웃 회피), 연결 종료(`req.signal` abort/cancel) 시 구독·인터벌 정리로 누수 방지. EventSource 자동 재연결 + 연결 시 현재 카운트 재전송으로 resync. 글 상세는 SSE 2개(알림·실시간 댓글)를 유지하므로 HTTP/1.1에선 호스트당 6연결 한도에 여러 탭이 막혀, 운영 nginx를 **HTTP/2**로 서빙(연결 다중화, `docs/deploy/lightsail.md` 6-1).
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

DB 로직은 prisma 호출을 mock하면 동어반복이 되므로, **임시 SQLite에 실제 쿼리를 돌려** 검증하는 통합 테스트 헬퍼(`lib/test-db.ts`)를 만들어 페이지네이션·검색·접근 제어·승인 흐름·댓글 깊이·좋아요·알림·속도 제한·신고까지 커버. 인증 계층도 가드: **JWT 위조 거부**(다른 시크릿·변조 토큰), **세션/리셋 쿠키**(`next/headers` 모킹), **DAL 인가**(역할·승인·`verifySession` 리다이렉트 — `React cache()`는 시나리오별 `resetModules`+재import로 우회), **인증 서버액션**(signin·signup·forgot-password 3단계 — 의존성 모킹, `redirect()`의 `NEXT_REDIRECT` throw 단언). **핵심 클라이언트 컴포넌트는 RTL(jsdom)**로도 검증 — 댓글 트리 병합 순수 로직(`merge`: 생성·수정·삭제·좋아요·dedup), 댓글 항목(작성자 링크·수정/삭제 권한·편집 흐름), 공유 바(클립보드·기기공유·X 인텐트), 내비 드로어(역할별 메뉴·`aria-expanded`·`inert`·Esc), 댓글 섹션 SSE 배선(가짜 이벤트 emit → 트리 갱신). 서버 액션·EventSource·toast는 `vi.mock`/주입으로 격리. 전체 **17 → 695 테스트**로 확장.

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
- **CSP 방식 선택**: nonce는 이 Next 버전에서 **전 페이지 동적 렌더를 강제**(정적 최적화·캐싱 포기)하므로 채택하지 않고, `script/style`은 `'unsafe-inline'`을 허용하되 **외부 스크립트 출처를 화이트리스트**(Turnstile `challenges.cloudflare.com`, Kakao SDK `t1.kakaocdn.net`)로 제한하고 `frame-ancestors 'none'`·`object-src 'none'`·`base-uri 'self'`·`form-action 'self'`로 클릭재킹·인젝션 표면을 차단. iframe은 `frame-src`로 Turnstile 위젯과 **YouTube 개인정보 보호 도메인(`www.youtube-nocookie.com`)만** 허용(일반 `youtube.com`·와일드카드 불허). 외부 https 이미지(본문·Neople·YouTube 썸네일)는 `img-src https:`로 허용, 폰트는 `next/font` self-host라 `font-src 'self'`. `upgrade-insecure-requests`·HSTS는 prod에만(로컬 http 깨짐 방지). 사용자 콘텐츠는 react-markdown이 raw HTML을 렌더하지 않아 잔여 인젝션 위험이 낮다.

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
- **자동 접근성 점검(axe-core) 일괄 보정**: 운영 빌드에 전 기능 샘플 글을 넣고 공개 16쪽×3테마·관리자 15쪽×2테마를 axe(WCAG 2.1 AA + best-practice)로 스캔. ① 기본(brand)·다크 테마에서 보조 글씨(`text-zinc-500`)가 3.69·4.1:1로 미달 → `text-zinc-500`이 글자색 전용임을 확인하고 어두운 테마에서 **`--color-zinc-500` 토큰을 zinc-400으로 교체**해 158곳 일괄 보정(호버·`dark:` 변형 유지), 밝은 테마의 단독 `text-zinc-400`(2.6:1) 38곳은 zinc-500으로. ② 관리자 글 폼 `Field`의 label이 입력과 미연결 → `htmlFor`/`id` + 오류 `aria-invalid`·`aria-describedby`, 여러 컨트롤 그룹(예약 발행)은 `fieldset`/`legend`. 관리자 닉네임 입력 label. ③ 마크다운 작업 목록 체크박스 이름("완료한/미완료 항목"). ④ 사이트 404가 Next 기본 화면(흰 배경·main 없음)이라 테마 대비 2.62:1 → 전역 `app/not-found.tsx`. ⑤ 신고 화면 h1. ⑥ 삭제 버튼·오류 문구의 `text-red-600`이 brand 배경 3.74:1 → 어두운 테마 `dark:text-red-400`(6.18:1) 47곳(배경용 `bg-red-600`이 있어 토큰 교체 대신 개별 지정). 재측정 결과 공개 16쪽×3테마·관리자 15쪽×2테마·오류 표시 상태까지 위반 0건. 스캔 중 사이트 자체 레이트 리밋(429)이 결과를 오염시켜 요청 간격을 두고 재측정.

### 4.20 코드 신택스 하이라이팅

마크다운 본문·미리보기 공유 렌더러(`MarkdownContent`)에 `rehype-highlight`(highlight.js)를 추가. **글 상세는 서버 컴포넌트라 하이라이트가 서버 렌더 시 1회 수행** → 공개 독자에겐 추가 클라이언트 JS 0(정적 HTML에 `hljs` 클래스). shiki 대신 highlight.js를 택해 번들·이미지 슬림화 기조 유지. 토큰 색은 단일 고정 테마 CSS 대신 `globals.css`에 **3테마(light/dark/brand) 정합**으로 직접 정의하고, 펜스 코드블록은 가로 스크롤·`font-mono`로, 인라인 code 배경이 블록에 새지 않게 `pre code`를 무력화. raw HTML 비허용은 그대로라 XSS 안전.

**본문 렌더 보강(코드 복사·헤딩 앵커·콜아웃·각주)**: 같은 렌더러에 독자 편의 요소를 더하되 서버 렌더 기조를 유지.

- **코드블록 상단 바**: 언어 라벨 + 복사 버튼. 복사 원문은 서버에서 hast 노드 텍스트(하이라이트 span 제거, 끝 개행 1개 제거)로 뽑아 prop으로 넘기므로 **클라이언트 섬은 버튼 하나**(DOM 탐색 없음). 결과는 버튼 문구와 `role="status"`로 안내, Clipboard API 부재(비보안 컨텍스트)·거부는 실패로 표시. 가로 스크롤 `pre`는 `tabIndex=0`으로 키보드 스크롤 가능.
- **헤딩 앵커**: h2·h3(목차 대상) 옆 `#` 딥링크를 **헤딩 밖 형제**로 둬 헤딩의 접근 가능한 이름을 오염시키지 않음. 호버·포커스 시 노출, `(hover: none)` 터치 기기는 상시 노출. id는 기존 `rehype-slug`(목차와 동일 슬러그).
- **콜아웃**: GitHub 문법 `> [!NOTE|TIP|IMPORTANT|WARNING|CAUTION]`을 의존성 없는 rehype 플러그인(`lib/markdown-plugins.ts`)으로 변환 — 인용이 아니라 보조 정보라 `blockquote` 대신 `role="note"` div + 한국어 제목. 표식이 없거나 미지원 종류면 일반 인용문 유지.
- **기본 요소 보정**: 모든 `li`에 `list-disc`가 걸려 번호 목록이 점으로 보이던 결함을 `ul`/`ol`별 스타일로 수정(작업 목록 항목은 마커 없음). 인용문·GFM 각주(라벨 "각주"·되돌아가기 이름 한국어화) 스타일 추가. 콜아웃 제목 색은 3테마 모두 옅은 틴트 배경 위 **6.5:1 이상**으로 산출해 고정.
- **이미지 확대·캡션**: 본문 이미지를 버튼으로 감싸 클릭 시 네이티브 `<dialog>.showModal()` 라이트박스(포커스 트랩·바깥 inert·Esc·닫힐 때 트리거로 포커스 복귀, 백드롭 클릭 닫기). 이미지는 문단 안에 올 수 있는데 `dialog`는 `p`의 자식이 될 수 없어 **열릴 때만 body로 포털**(마크업 유효성 + 큰 이미지 지연 로드). 링크 안 이미지는 `a` 안 `button` 중첩을 피하려 확대 없이 둔다 — 서버 컴포넌트라 context 대신 hast 단계에서 표시(`rehypeMarkLinkedImages`). 제목이 있는 단독 이미지(`![alt](src "캡션")`)는 `rehypeFigures`가 `figure`/`figcaption`으로 바꾸고 img의 title을 제거(alt와 캡션을 분리해 스크린리더 중복 낭독·툴팁 중복 방지). 같은 변환을 RSS 본문에도 적용.
- **YouTube 임베드(파사드)**: 단독 줄의 YouTube 링크(`https://youtu.be/…` 또는 `[제목](…)`)를 `rehypeEmbeds`가 임베드로 표시하고 `YouTubeEmbed`가 **썸네일 + 재생 버튼만** 먼저 렌더, 클릭 시에만 `youtube-nocookie` iframe(autoplay·start)을 로드 → 페이지 로드 시 플레이어 JS·추적 요청 0, `aspect-video` 상자로 CLS 0. URL은 `parseYouTube`가 https·정확한 호스트·11자 id만 인정(위장 호스트·채널 등 거부), `t=1m30s`류 시작 시각 해석. 재생 후 포커스를 iframe으로 옮기고, iframe `title`(링크 텍스트 또는 일반 명칭)·"YouTube에서 보기" 대체 링크 제공. 문장 속 링크는 그대로, RSS는 링크로 유지.
- **수식·다이어그램**: 수식은 remark-math + rehype-katex로 **서버에서 렌더**(HTML + 스크린리더용 MathML) → 글 상세 독자에게 추가 JS 0, RSS엔 CSS 없이 보이는 MathML만. 인라인은 `$$…$$`만 인정하고 한 개짜리 `$`는 꺼 "$5" 같은 금액 표기의 오인을 막음(블록은 `$$` 줄·``math). `trust:false`로 `\href` 등 링크/HTML 생성 명령 차단. rehype-katex·remark-math가 katex ^0.16을 고정해 0.16 계열 저심각 권고가 남아, 공개 API만 쓰는 점·0.17/0.18 breaking이 내부 API·CSS 클래스뿐임을 확인하고 **트리 전체를 katex 0.18로 override**(화면 CSS와 렌더 버전 일치). 다이어그램은 ``mermaid를 `MermaidDiagram`이 **화면 근처에 올 때만 동적 import**(다이어그램 없는 글은 로드 0)해 그리고 테마 토글 시 다시 그림. 회원 글에도 쓰일 수 있어 이중 방어 — `securityLevel:"strict"` + 라벨을 SVG 텍스트로(`htmlLabels:false`) + 완성 SVG를 DOMPurify로 재정화(스크립트·이벤트 핸들러·`foreignObject` 제거). 검증 중 기본 HTML 라벨이 정화로 사라지는 것을 발견해 SVG 텍스트 라벨로 전환. 그리기 전·실패 시엔 원문 코드, 렌더 후엔 "원문 보기" 접이식 제공. mermaid는 공개 2주 이상 지난 12.2.0으로 고정.

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

### 4.24 발견성·구독 보강 (수정일·RSS 전문·아카이브·소개·llms.txt)

- **수정일(`Feed.editedAt`)**: `updatedAt`(`@updatedAt`)은 조회수 증가·숨김·시리즈 정렬 등 **모든 update에 갱신**돼, 기존 JSON-LD `dateModified`·sitemap `lastmod`가 사실상 "마지막 조회 시각"을 내보내고 있었다. 게시 글의 제목·요약·본문이 **실제로 바뀐 저장에서만** 기록하는 `editedAt`을 추가(관리자 `updateFeed`·회원 `publishPost` 수정 경로, 비교는 순수 `bodyChanged` — 공개범위·태그만 바꾼 저장·초안/예약 글 편집·임시저장→게시 전환은 제외). 화면엔 표시 날짜와 **KST 날짜가 다른 수정만** "· 수정 {날짜}"(`<time>`)로 노출(당일 오타 정정 생략), 검색엔진용은 `feedLastModified = editedAt ?? publishedAt ?? createdAt`. 기존 행은 NULL로 시작(마이그레이션은 컬럼 추가만).
- **RSS 전문(`content:encoded`)**: 전체·시리즈 RSS에 본문 HTML을 CDATA로 수록(본문 속 `]]>`는 구간 분할). 변환은 unified(remark-parse·gfm → remark-rehype → rehype-stringify)로 화면 렌더러와 **같은 GFM·콜아웃 규칙**을 쓰되 하이라이트·복사 버튼·앵커는 뺀 순수 HTML. raw HTML은 버리고 링크·이미지 URL엔 화면과 같은 `defaultUrlTransform` 스킴 정책(`javascript:`·`data:` 제거, `rehypeSafeUrls`)을 적용해 XSS 정책 동일, 리더는 사이트 밖에서 렌더하므로 `/uploads/…`·`/feed/…` 상대 경로를 **절대 URL로 재작성**(`rehypeAbsoluteUrls`). 시리즈 RSS는 가시성 필터를 통과한 id로만 본문을 1쿼리 추가 조회.
- **아카이브(`/archive`)**: `/feed`와 같은 범위(관리자 글)의 게시·미숨김·뷰어 가시 글을 **KST 연→월**로 묶은 전체 목록(`groupByYearMonth` — UTC 12/31 15:00 = KST 새해 경계 테스트). 연 `section`/h2 → 월 h3 → `ul`, 날짜는 `<time>`. 내비 드로어·sitemap에 추가.
- **소개(`/about`, 관리자 편집)**: 본문 마크다운을 싱글톤 `SiteConfig`(`aboutContent`·`aboutUpdatedAt`)에 저장하고 `/admin/about`에서 작성/미리보기 탭(회원 에디터 패턴)·관리자 이미지 업로드 재사용으로 편집. 저장은 `verifySession` + zod 길이 상한(2만 자) + 감사 로그(`site.about`) + 레이아웃 재검증. **비우면 비공개**: `/about`은 404, 내비 링크·sitemap·llms.txt에서 빠진다 — 레이아웃이 매 요청 확인하므로 본문을 읽지 않는 `count` 조회(`hasAbout`)로 가볍게. 공개 페이지는 점검 모드 가드, `AboutPage` JSON-LD(사이트 `Organization` @id 참조)와 평문 요약 메타 설명.
- **`/llms.txt`**: llmstxt.org 형식(H1 사이트명 → 인용 요약 → 주요 페이지·최근 글 링크)으로 AI 검색·에이전트용 안내. RSS·sitemap과 같은 공개 범위(전체공개·게시·미숨김) 최근 50개, 링크 텍스트의 대괄호 이스케이프.

### 4.25 글별 읽기 지표 (완독률·읽은 시간, 익명·일 단위)

조회수만으로는 "열어 보고 바로 나간 글"과 "끝까지 읽힌 글"을 구분할 수 없어, 글별 **완독률·평균 읽은 시간**을 `/admin/stats`에 표로 노출.

- **저장(새 식별자 없음)**: 조회 트래킹이 만든 `View` 행(방문자 쿠키·글·KST 일 유니크)에 `scrollDepth`(최대 깊이 %)·`activeSeconds`(누적 활성 초) 두 컬럼만 덧붙인다. 새 쿠키·행을 만들지 않으며, 오늘의 조회 기록이 없으면 비콘은 무시(`recordRead`). 깊이는 최댓값, 시간은 누적하되 방문자·글·하루당 3600초 상한.
- **측정(클라이언트 `ReadTracker`)**: 깊이는 문서가 아닌 **본문(article) 기준**(화면 아랫단이 본문 몇 %에 닿았나 — 댓글 길이 영향 없음, 한 화면 글은 100). 시간은 5초 틱으로, 탭이 보이고 마지막 상호작용(스크롤·키·포인터)이 30초 이내일 때만 적립(방치 탭 제외).
- **전송**: `visibilitychange`(hidden)·`pagehide`·언마운트(사이트 내 이동) 시 `navigator.sendBeacon`으로 `/api/read`에 text/plain JSON(프리플라이트 없음). 헤드리스 검증에서 **문서 언로드 순간의 비콘이 유실되는 경우**를 확인해, 활성 시간이 30초 쌓일 때마다 페이지가 살아 있는 동안에도 보내도록 보강(유실 상한 30초).
- **수신 보호**: 방문자 쿠키(`vid`)는 SameSite=Lax라 타 사이트발 POST엔 실리지 않음 → 외부에서 남의 지표 조작 불가. zod로 깊이 0~100·비콘당 증분 ≤ 600초 검증, 쿠키 없으면 204 무시.
- **집계**: 최근 30일 조회 상위 글별로 측정(비콘 수신) 조회를 분모로 완독(깊이 ≥ 90%) 비율·평균 활성 시간(`getReadStats`, Prisma `groupBy` 3회). 측정 도입 전 조회·비콘이 오지 않은 조회는 분모에서 빠지므로 "조회 / 측정"을 함께 표시, 미측정은 "—". 표는 열·행 머리글(`th scope`) 시맨틱.

### 4.26 글 수정 이력 (리비전·비교·되돌리기)

관리자 글을 실수로 덮어써도 복구할 수 있도록 저장 직전 버전을 남긴다.

- **스냅샷**: `updateFeed`가 제목·요약·본문이 실제로 바뀐 저장(`bodyChanged`)에서만 **바뀌기 직전 버전**을 `FeedRevision`에 남긴다. 저장과 **같은 트랜잭션**이라 slug 중복 등으로 저장이 실패하면 이력도 남지 않는다. 공개범위·태그만 바꾼 저장은 제외. 글당 최근 20개만 보존(초과분 정리), 글 삭제 시 CASCADE.
- **비교**: `/admin/[id]/revisions`(최신순 목록) → 한 건을 고르면 "이 버전 → 현재"의 제목·요약 변화와 본문 **줄 단위 diff**(jsdiff, 바뀐 줄 앞뒤 3줄만 남기고 긴 동일 구간은 접음). 추가·삭제는 `<ins>`/`<del>` + 보조기술용 "추가/삭제" 라벨 + 색에 의존하지 않는 `+`/`−` 기호.
- **되돌리기**: 확인 모달 후 `restoreRevision`이 **현재 버전을 먼저 이력으로 남기고** 같은 트랜잭션에서 교체 → 되돌리기도 되돌릴 수 있다. 게시 글이면 수정일(`editedAt`) 갱신, 감사 로그 `feed.restore`.
- **줄바꿈 정규화(검증 중 발견)**: 브라우저는 폼 제출 시 textarea 값을 **CRLF**로 보내, 다른 경로(LF)로 저장된 본문과 비교하면 모든 줄이 바뀐 것으로 보였다. `bodyChanged`·diff 모두 CRLF/LF와 마지막 줄 끝 개행 차이를 같은 내용으로 취급하도록 정규화(불필요한 이력·수정일 방지).
- **관리자 랜드마크**: 관리자 레이아웃에 `main` 랜드마크가 없던 것을 함께 보강(페이지 본문을 `<main>`으로). 같은 제목의 이력이 여럿일 수 있어 목록 링크 이름에 시각·길이를 포함해 링크 목록에서 구별되게 했다.

## 5. 성과 요약

- 런타임 이미지 **2.05GB → 876MB (−57%)**, 배포 첫 pull **10분 32초 → 37초**
- 운영 장애(디스크 고갈·OOM) 원인 규명 및 해소 → 배포 성공률·안정성 확보
- Prisma 7 드라이버 어댑터 도입으로 런타임 엔진 바이너리 제거
- 단일 관리자 → 가입·승인 회원 + 댓글·좋아요·알림·신고·모더레이션·PWA로 커뮤니티 기능 확장(역할 유니온 세션·공용 접근 제어)
- 통합 테스트 도입(17 → 695), CI에서 타입체크·린트·테스트·이미지 빌드 게이트
- 기능 단위 PR + 자동 배포 + pre-1.0 semver 버전 관리로 변경 이력 정리
