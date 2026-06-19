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

### 4.3 Prisma 7 드라이버 어댑터

Prisma 7이 내장 쿼리 엔진을 제거함에 따라 `@prisma/adapter-better-sqlite3` 드라이버 어댑터를 도입. 런타임 쿼리에 Rust 엔진 바이너리가 불필요해져 4.1의 이미지 슬림화와 함께 의존성·크기를 추가로 절감.

- **동시성 튜닝**: SQLite를 **WAL 모드**로 전환(`PRAGMA journal_mode=WAL`, 파일 레벨 영구)해 쓰기(조회수 트래킹·댓글·좋아요)가 읽기를 막지 않게 했고, `busy_timeout`은 어댑터 `timeout`으로 명시(5000ms). 좋아요/댓글 좋아요 토글은 `find→토글→count`를 **`$transaction`으로 원자화**해, 동시 토글이 await 사이에 인터리빙돼 카운트가 어긋난 채 SSE로 브로드캐스트되는 것을 방지.

### 4.4 회원 시스템 — 승인 흐름 + 역할 유니온 세션

비밀번호만으로 들어가는 단일 관리자에서, 가입·승인 흐름을 가진 외부 회원으로 인증을 확장.

- **세션 유니온**: 쿠키 페이로드를 `{role:"admin"} | {role:"member", userId, nickname}` 유니온으로 모델링. 분배형 `Omit` 유틸로 member 전용 필드를 잃지 않고 직렬화.
- **승인 흐름**: 가입은 `pending` 생성 → 관리자 승인 시 `approved`. 거절은 행을 지우지 않고 `rejected` + 사유 기록 → 같은 이메일 재신청 시 같은 행을 `pending`으로 되돌려 과거 사유를 관리자에게 보존.
- **비밀번호 재설정**: 6자리 코드를 메일로 발송(scrypt 해시 저장, 평문 미보관), 3분 만료 + 시도 횟수 제한 + 재발송 쿨다운(메일 폭탄 방지). SMTP 미설정 환경에선 콘솔 로그로 폴백해 로컬 개발을 막지 않음.
- 비밀번호 해시는 표준 라이브러리 `scrypt`(`salt:hash`)로 자체 구현, 외부 의존성 없이 검증.

### 4.5 공개 범위 3단계 접근 제어 (피드·던파 공용)

전체공개 / 회원공개 / 비공개(초안)를 SQLite에서 네이티브 enum 없이 앱 레이어 유니온 타입으로 구현하고, 단건과 목록에 일관 적용.

- **단일 판정 함수**: `checkAccess(visibility, role)`(단건: ok / members-only / not-found)와 `listableVisibilities(role)`(목록 필터)로 규칙을 한 곳에 모아 피드·던파가 공유.
- 비공개는 비어드민에게 **404**(존재 자체 숨김), 회원공개는 비로그인에게 **가입 유도 게이트**, 관리자는 비공개 초안까지 목록·상세에서 열람(목록엔 "비공개" 배지). 비공개 글은 공유 버튼을 숨겨 무의미한 외부 링크 노출을 차단.
- 마이그레이션 시 기존 데이터의 의미를 보존(예: 기존 항목을 적절한 등급으로 이관)하도록 데이터 변환 SQL을 수동 작성.

### 4.6 댓글·좋아요·북마크

2뎁스 댓글(답글)과 피드·댓글 좋아요, 개인 북마크를 Server Action으로 구현.

- 답글은 최상위 댓글에만 허용(깊이 검증), 삭제는 자식 유무에 따라 soft/hard 분기. 좋아요는 `(user, 대상)` 유니크로 토글. 작성자는 본인 댓글을 수정 가능(`editedAt` 기록 → "(수정됨)" 표시, SSE로 라이브 반영). 인기순 정렬에서 삭제 댓글은 좋아요 무관 하단(`deletedAt` nulls-first).
- **북마크(저장)**: 좋아요와 동형(`Bookmark` `(user, feed)` 유니크 토글)이나 **회원 전용·개인용**이라 공개 카운트·실시간(SSE) 없음 → 낙관 토글 + 디바운스만(admin은 저장 목록이 없어 버튼·액션에서 제외). `/account/saved`에서 저장 시각 최신순으로 모아보며(목록 카드 마크업은 `FeedCardItem`으로 공개 목록과 공유), 저장 후 비공개·숨김된 글은 회원 가시 범위 필터로 목록에서 제외.
- 관리자 작성 글의 알림 수신을 위해 로그인 불가한 **예약 관리자 User**(싱글톤)를 두어, 세션에 `userId`가 없는 관리자도 도메인 모델에서 작성자/수신자로 표현.

### 4.7 PWA + 웹 푸시 + 인앱 알림

설치형 PWA와 알림을 함께 구축.

- **PWA**: `manifest` + 서비스 워커(오프라인 캐싱) + 아이콘. 서비스 워커는 푸시 수신·클릭 시 해당 URL로 포커스/오픈.
- **웹 푸시**: VAPID(web-push) 기반, 기기별 구독을 `endpoint` 유니크로 저장하고 만료(404/410) 구독은 발송 중 자동 정리.
- **인앱 알림 센터**: 댓글→피드 주인, 답글→부모 댓글 작성자에게 알림 생성. 진입 시 자동 읽음 처리, 알림 클릭 시 `?c={commentId}`로 **해당 댓글 스크롤·하이라이트**(답글이면 부모 스레드 자동 펼침). 이후 사용자 작성 게시물로 "주인" 개념을 일반화할 선수 작업.
- **@멘션 알림**: 댓글 본문의 `@닉네임`으로 멘션된 **승인 회원**에게 인앱+푸시. 닉네임이 **DB 유일 제약 없음 + 공백·구두점 허용**이라 정규식 파싱 대신 **승인 회원을 순회하며 `content`에 `@<닉네임>` 포함 여부로 매칭**(공백 닉네임·한국어 접미 견고; 본인·미멘션·`notifyOnMention` off·비승인 제외). 표시에선 `@토큰`을 색 강조(닉네임 비유일이라 링크는 생략). 멘션 팬아웃은 대상이 여럿이라 **배치**로 처리 — 인앱은 `createMany`+`groupBy`(미읽음 일괄 집계), 푸시는 `pushSubscription … userId in [...]` 한 번 조회 후 병렬 전송이라 **대상 수와 무관하게 상수 쿼리**(N+1 제거).
- **알림 환경설정**: 회원이 종류별(답글·내 글 댓글·**멘션**)로 수신 on/off(`User.notifyOnReply/notifyOnComment/notifyOnMention`). 이벤트 단위 제어라 off면 **인앱·푸시 모두 미생성**(notify 함수가 수신자 설정을 확인 후 스킵). 기기별 푸시 구독(`PushToggle`)과 직교 — 한쪽은 "어떤 이벤트로", 다른 쪽은 "이 기기로". 진입은 **알림 센터(`/notifications`)에 있을 때 헤더 종이 설정 톱니바퀴로 전환**(미읽음이 0으로 처리된 페이지라 배지가 무의미 → 설정 진입으로 대체, 회원 한정·관리자는 종 유지).
- **실시간 알림(SSE)**: 헤더 벨 배지를 **서버센트 이벤트**로 실시간 갱신(웹 푸시는 닫힌 탭용, SSE는 열린 탭용 — 상보). 단일 컨테이너라 **인메모리 채널 버스**(`lib/events.ts`, rate-limit Map과 동형)에 `createNotification`/`markAllRead`이 미읽음 수를 publish하고, `/api/events` 라우트가 `ReadableStream`으로 구독자에게 전달. nginx **무수정**(응답 `X-Accel-Buffering: no` + 25초 하트비트로 버퍼링·idle 타임아웃 회피), 연결 종료(`req.signal` abort/cancel) 시 구독·인터벌 정리로 누수 방지. EventSource 자동 재연결 + 연결 시 현재 카운트 재전송으로 resync.
- **실시간 댓글(SSE)**: 같은 버스의 `feed:{id}` 채널로 확장. 댓글 작성·삭제 서버 액션이 `CommentEvent`(생성 노드/삭제 id)를 publish하고, `/api/feed-events` 라우트가 **글 상세와 동일한 접근 게이트**(`checkAccess`+초안·숨김 차단, 공개 글은 anon도 구독)로 전달. 클라이언트는 낙관적 삽입과 **동일한 순수 병합 함수**(`merge.ts`의 `applyCreated`/`applyEdited`/`applyDeleted`/`applyLikeCount`)로 트리에 반영하며, **id 기반 dedup**으로 본인 낙관적 삽입·SSE 에코·`loadMore` 재등장 중복을 흡수(원격 이벤트는 스크롤 없음). **댓글·글(게시물) 좋아요 수도 같은 채널로 실시간** 반영(연타는 ~500ms 디바운스로 1요청). 좋아요 버튼은 댓글 트리 밖 형제라, `feed:{id}` 채널의 **단일 EventSource를 클라이언트 provider(`FeedEventsProvider`)로 공유**해 댓글 섹션·좋아요 버튼이 연결 1개를 나눠 쓴다(공개 글 익명 뷰어의 연결 중복 방지). 채널은 `FeedEvent`(댓글 이벤트 ∪ `feedLike`) union을 나르고 각 소비자가 `kind`로 분기. 연결이 끊긴 동안(배포 재시작·네트워크 드롭) 발생한 이벤트는 라이브로 못 받지만, **재접속(EventSource `onopen` 재발생) 시 provider가 `resync` 신호를 팬아웃**해 댓글 섹션은 현재 로드량만큼 페이지를, 좋아요 버튼은 요약을 다시 받아 권위 상태로 교체한다(unread 벨이 connect 시 현재값을 재전송하는 것과 동형의 재동기화).

### 4.8 전역 요청 속도 제한 (어뷰징 방지)

전반적 요청 폭주를 막기 위해 `proxy.ts`에서 IP당 고정 윈도우 카운터(120req/10s 초과 시 429)를 적용.

- Next 16 proxy가 **Node 런타임**으로 동작함을 문서로 확인 → 단일 인스턴스(`next start`) 프로세스에서 인메모리 `Map` 상태가 유지되어 외부 스토어 없이 신뢰성 확보.
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

### 4.11 테스트 전략

DB 로직은 prisma 호출을 mock하면 동어반복이 되므로, **임시 SQLite에 실제 쿼리를 돌려** 검증하는 통합 테스트 헬퍼(`lib/test-db.ts`)를 만들어 페이지네이션·검색·접근 제어·승인 흐름·댓글 깊이·좋아요·알림·속도 제한·신고까지 커버. 인증 계층도 가드: **JWT 위조 거부**(다른 시크릿·변조 토큰), **세션/리셋 쿠키**(`next/headers` 모킹), **DAL 인가**(역할·승인·`verifySession` 리다이렉트 — `React cache()`는 시나리오별 `resetModules`+재import로 우회), **인증 서버액션**(signin·signup·forgot-password 3단계 — 의존성 모킹, `redirect()`의 `NEXT_REDIRECT` throw 단언). 전체 **17 → 365 테스트**로 확장.

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

### 4.17 발견성 페이지 (인기 글·태그 인덱스)

쌓이던 조회수·태그를 공개적으로 탐색하게 하는 두 페이지(`/feed/popular`·`/feed/tags`)를 `app/feed/` 아래 두어 점검 모드 가드를 상속.

- **인기 글**: `getPublicTopFeeds(role)`가 누적 조회수순으로 게시·미숨김 글을 **뷰어 가시 범위**(`listableVisibilities`)로 반환 — admin 전용 `getTopFeeds`와 달리 visibility를 필터해 공개 노출에 안전. 카드 UI는 `FeedCardItem` 재사용.
- **태그 인덱스**: `getTagsWithCounts(role)`가 `feedTag.groupBy` + 관계 `where`(가시 글)로 글 수를 집계해, **가시 글이 1개 이상인 태그만** 글 수와 함께 내림차순 반환(비공개/숨김 전용 태그는 빈 링크가 되지 않게 제외). 기존 `?tag=` 필터로 연결.
- 진입은 nav 드로어·홈 둘러보기 카드·sitemap에 추가(개별 태그 URL은 카디널리티 이유로 sitemap 제외).

### 4.18 DB 자동 백업

`/data/prod.db`(WAL) 손상·실수 삭제·잘못된 마이그레이션에 대비한 **자격증명 없는 로컬 백업**.

- **스크립트**(`scripts/backup-db.sh`): sqlite **온라인 `.backup`**(쓰기 중에도 일관된 스냅샷, WAL 반영) → gzip → `find -mtime`으로 N일(`BACKUP_KEEP_DAYS`, 기본 14) 회전. 런타임 이미지에 `sqlite3` CLI를 추가하고 스크립트를 베이크(앱 의존성 그래프 무변경 — `next.config`의 lib import가 일으킨 502 교훈 반영해 self-contained 셸만).
- **스케줄**(`.github/workflows/backup.yml`): 매일 04:00 KST + 수동(`workflow_dispatch`). 기존 배포와 **동일 SSH 시크릿**으로 호스트에 접속해 `docker compose exec -T web sh scripts/backup-db.sh` 실행 — 상시 사이드카 없이(512MB 인스턴스 RAM 절약) 정확한 일정.
- 복원 가능성은 테스트로 가드(백업본 gunzip 후 `PRAGMA integrity_check`=ok·행 보존, 회전 동작). 오프사이트(인스턴스 유실 대비 R2/B2)는 후속 과제.

### 4.19 읽기 경험 (이전/다음 글·진행바·맨 위로)

글 상세에 가벼운 읽기 보조 3종을 추가.

- **이전/다음 글**: `getAdjacentFeeds(feed, role)`가 시간순 인접 글 1건씩을 뷰어 가시 범위 + **같은 작성자 분류**(관리자 글↔관리자 글, 회원 글↔회원 글)로 조회 — 독자가 보던 컬렉션을 벗어나지 않게. 본문 푸터에 `RelatedFeeds` 스타일로 렌더(둘 다 없으면 미표시).
- **읽기 진행바**(`reading-progress-bar`): 뷰포트 상단 고정 바가 문서 스크롤 진행률 표시. passive 스크롤 + `requestAnimationFrame` 스로틀, 장식이라 `aria-hidden`.
- **맨 위로**(`back-to-top-button`): 임계 스크롤 초과 시 우하단에 등장(미표시 땐 DOM 미렌더 → 포커스 제외), 클릭 시 최상단으로. JS smooth는 전역 CSS `scroll-behavior` override가 적용되지 않으므로 `matchMedia`로 reduced-motion을 직접 분기.

### 4.20 코드 신택스 하이라이팅

마크다운 본문·미리보기 공유 렌더러(`MarkdownContent`)에 `rehype-highlight`(highlight.js)를 추가. **글 상세는 서버 컴포넌트라 하이라이트가 서버 렌더 시 1회 수행** → 공개 독자에겐 추가 클라이언트 JS 0(정적 HTML에 `hljs` 클래스). shiki 대신 highlight.js를 택해 번들·이미지 슬림화 기조 유지. 토큰 색은 단일 고정 테마 CSS 대신 `globals.css`에 **3테마(light/dark/brand) 정합**으로 직접 정의하고, 펜스 코드블록은 가로 스크롤·`font-mono`로, 인라인 code 배경이 블록에 새지 않게 `pre code`를 무력화. raw HTML 비허용은 그대로라 XSS 안전.

### 4.21 초안 자동저장 (localStorage, 누적/용량 안전)

작성 에디터(회원·관리자)에 새로고침·실수 이탈 시 작업 유실을 막는 localStorage 자동저장을 추가. 핵심은 **누적·용량 폭주를 막는 안전 스토어**(`lib/draft-store.ts`)다.

- **안전장치**: 글당 키 1개(`byjang-draft:<scope>:<id|new>`)로 **overwrite(append 아님)** → 항목 무한증식 방지. 저장본에 `savedAt`을 남겨 **7일 TTL**, 개수 상한(12)·만료를 마운트 시 `pruneDrafts()`로 스윕. 직렬화 길이 캡(1M 코드유닛) 초과는 스킵. `setItem`이 `QuotaExceededError`로 던지면 **정리 후 1회 재시도, 그래도 실패면 조용히 포기** — 자동저장은 best-effort라 타이핑·제출을 절대 막지 않음(`typeof window` 가드 + 전 구간 try/catch).
- **두 에디터**: 회원 에디터는 controlled state라 값으로 저장/복원, 관리자 폼은 uncontrolled라 `form onInput`으로 `FormData`를 읽어 저장하고 복원 시 `elements.namedItem`으로 값을 채움(이미지 삽입 후엔 합성 `input` 이벤트로 자동저장이 잡게). 저장본이 초기값과 다를 때만 `DraftRestoreBanner`로 **복원/무시**를 제안(자동 덮어쓰기 안 함).
- **수명주기**: 제출 시 키 삭제(성공은 리다이렉트로 종료). 검증 실패로 리다이렉트가 없으면 `state` 변화 effect가 현재 값을 **재저장**해 데이터 유실 창을 닫음.

### 4.22 이미지 CLS 방지 + lazy-load

본문 이미지가 치수 없이 렌더돼 로드 시 레이아웃이 밀리던(CLS) 문제를 제거. nginx가 `/uploads/*`를 직접 서빙해 `next/image`가 부적합하므로 **plain `<img>` + 치수 속성**으로 해결.

- **업로드 시 치수 측정**: `uploadImage`가 버퍼를 `image-size`(헤더만 파싱)로 읽어 삽입 마크다운 URL에 `?w=&h=`를 실음(`lib/image-size.ts`는 `server-only` — `lib/upload.ts`가 클라에서도 쓰이므로 격리). 손상·미지원은 null → 쿼리만 생략(업로드는 계속).
- **렌더**: `MarkdownContent`의 커스텀 `img`가 src 쿼리에서 w/h를 파싱해 `width/height`를 부여 → 브라우저가 종횡비로 공간을 예약(시프트 0), `[&_img]:h-auto`로 반응형 유지. 모든 본문 이미지에 `loading="lazy" decoding="async"`. 쿼리 없는 외부 이미지는 lazy만. 쿼리는 nginx·dev 라우트가 무시(파일 그대로 서빙).

## 5. 성과 요약

- 런타임 이미지 **2.05GB → 876MB (−57%)**, 배포 첫 pull **10분 32초 → 37초**
- 운영 장애(디스크 고갈·OOM) 원인 규명 및 해소 → 배포 성공률·안정성 확보
- Prisma 7 드라이버 어댑터 도입으로 런타임 엔진 바이너리 제거
- 단일 관리자 → 가입·승인 회원 + 댓글·좋아요·알림·신고·모더레이션·PWA로 커뮤니티 기능 확장(역할 유니온 세션·공용 접근 제어)
- 통합 테스트 도입(17 → 365), CI에서 타입체크·린트·테스트·이미지 빌드 게이트
- 기능 단위 PR + 자동 배포 + pre-1.0 semver 버전 관리로 변경 이력 정리
