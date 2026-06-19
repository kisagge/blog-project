# 추가 기능 · 개선 후보

랜딩 개선(v0.42.0) 이후 논의한 후보 백로그. 우선순위·상태는 자유롭게 갱신.

| #   | 후보                     | 설명                                                                                                                                                                                                | 상태 |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | 글 태그                  | 글에 태그(최대 5개) + 태그별 목록·필터. 콘텐츠 탐색성↑                                                                                                                                              | 완료 |
| 2   | 동적 OG 이미지           | 글마다 `next/og`로 og:image 자동 생성 → SNS 공유 카드 개선                                                                                                                                          | 완료 |
| 3   | RSS 피드                 | `/rss.xml` 구독 피드. 구독자·SEO·배포                                                                                                                                                               | 완료 |
| 4   | 읽는 시간 · 목차(TOC)    | 긴 글 가독성(예상 읽기 시간, 헤딩 기반 TOC)                                                                                                                                                         | 완료 |
| 5   | 회원 프로필/활동 페이지  | 회원 공개 프로필(작성 글·댓글) `/u/[id]`·`/me`. 글 상세·댓글·피드카드 작성자 닉네임에서 링크                                                                                                        | 완료 |
| 6   | 콘텐츠 신고 · 모더레이션 | 댓글/회원 글 신고 → 관리자 큐에서 숨김(복구)·기각. `/admin/reports`                                                                                                                                 | 완료 |
| 7   | 마크다운 도움말          | 회원 글쓰기에 작성/미리보기 탭 + 접이식 문법 도움말. 게시 화면과 동일 렌더러 공유                                                                                                                   | 완료 |
| 8   | 로그인 CAPTCHA           | 가입·로그인·비번재설정 요청에 Cloudflare Turnstile(무료). 키 미설정 시 비활성. 서버 액션 토큰 검증                                                                                                  | 완료 |
| 9   | 실시간 알림(SSE)         | 헤더 알림 벨이 새 댓글·답글·신고 시 새로고침 없이 즉시 갱신. 인메모리 버스 + SSE                                                                                                                    | 완료 |
| 10  | 실시간 댓글(SSE)         | 글 상세에서 타인 댓글·삭제가 실시간 반영(#9의 이벤트 버스 재사용). 낙관적 삽입과 동일 병합+dedup                                                                                                    | 완료 |
| 11  | 실시간 좋아요(SSE)       | 댓글·글(게시물) 좋아요 수가 실시간 반영. 좋아요 버튼은 `FeedEventsProvider`로 피드 SSE 연결 1개 공유                                                                                                | 완료 |
| 12  | SSE 재동기화             | 연결 끊김 동안 유실된 댓글·좋아요 이벤트를 재접속(onopen) 시 리페치로 복구(권위 상태 재조회). Last-Event-ID 링버퍼 대신 단순·견고                                                                   | 완료 |
| 13  | 북마크 · 저장            | 회원이 글을 저장하고 `/account/saved`에서 모아보기(개인용 — 공개 카운트·실시간 없음). `FeedCardItem` 공유                                                                                           | 완료 |
| 14  | 전문 검색(SQLite FTS5)   | 글 본문 전문 검색. trigram(한국어 부분일치) + BM25 관련도 랭킹, 기존 Prisma 필터 재사용                                                                                                             | 완료 |
| 15  | 알림 환경설정            | 회원이 알림 종류별(답글·내 글 댓글) on/off. off면 인앱·푸시 모두 미생성. `/account/notifications`                                                                                                   | 완료 |
| 16  | 관련 글 추천(태그)       | 글 상세 하단에 같은 태그를 공유하는 다른 글 추천(`getRelatedFeeds`, 공유 태그 수순). 기존 태그·접근제어 재사용                                                                                      | 완료 |
| 17  | @멘션 + 멘션 알림        | 댓글 @닉네임 멘션 → 멘션된 승인 회원에게 알림(인앱+푸시). 닉네임 비유일·공백 허용이라 회원 순회 매칭, 환경설정 토글·본문 강조                                                                       | 완료 |
| 18  | 관리자 통계 대시보드     | 조회수 추이·가입 추이·인기글·요약을 `/admin/stats`에 CSS 바로 시각화(View.day groupBy + raw date(+9h))                                                                                              | 완료 |
| 19  | 이메일 다이제스트        | 미읽음 인앱 알림/새 글을 주기적으로 묶어 이메일 발송(기존 SES 메일러 `lib/mailer.ts` 재사용, 회원별 수신 on/off·수신거부). 트리거 수단(수동 관리자 버튼 / GitHub Actions cron / 컨테이너 cron) 미정 | 보류 |
| 20  | 보안 헤더(CSP·HSTS 등)   | `next.config.ts` headers()로 CSP·X-Frame-Options·X-Content-Type-Options·Referrer-Policy·Permissions-Policy·HSTS. CSP는 no-nonce(정적 렌더 유지) + 외부 스크립트 출처 화이트리스트(Turnstile·Kakao)  | 완료 |
| 21  | SEO 구조화 데이터        | 글 상세에 JSON-LD(BlogPosting/BreadcrumbList) + 명시적 canonical. 검색 리치 스니펫·CTR 개선                                                                                                         | 완료 |
| 22  | 발견성 페이지            | 공개 인기 글(viewCount 상위) 목록 + 태그 인덱스(전체 태그·글 수). 기존 Tag·searchFeeds 재사용                                                                                                       | 완료 |
| 23  | 인증/DAL·서버액션 테스트 | `lib/dal`·`session`·`reset-token`·`mailer`·`jwt` + signin/signup/forgot-password 서버 액션 테스트(인가 우회·세션 회귀 방지)                                                                         | 완료 |
| 24  | 민감 액션 레이트리밋     | 로그인 브루트포스·가입·코드요청·신고에 per-action 제한(전역 IP 제한 외, 기존 `rateLimit` 유틸 재사용)                                                                                               | 완료 |
| 25  | DB 자동 백업             | `/data/prod.db` 일별 sqlite `.backup` → gzip → /data/backups N일 회전(GitHub Actions cron). 손상·실수·마이그레이션 대비                                                                             | 완료 |
| 25b | DB 오프사이트 백업       | 25의 로컬 백업을 R2/B2/S3로 업로드(인스턴스 유실 대비 DR). 객체저장소 자격증명 필요                                                                                                                 | 보류 |
| 26  | 읽기 UX                  | 글 상세 이전/다음 글 내비게이션·읽기 진행바·맨 위로 버튼                                                                                                                                            | 완료 |
| 27  | 코드 신택스 하이라이팅   | 마크다운 코드블록 하이라이트(rehype-highlight, 글 상세 서버 렌더 → 독자 추가 JS 0). globals.css에 3테마 토큰 색                                                                                     | 완료 |
| 28  | 이미지 최적화/CLS 방지   | 업로드 시 image-size로 치수 측정 → 마크다운 URL `?w&h` → 커스텀 `<img>`에 width/height(시프트 제거)·lazy-load. Core Web Vitals                                                                      | 완료 |
| 29  | CI 위생 + 의존성 자동화  | `prettier --check`·`pnpm audit` CI 게이트 + `.github/dependabot.yml`(공급망·포맷 회귀 차단)                                                                                                         | 보류 |
| 30  | 예약 발행                | 글에 예약 시각 설정 → GitHub Actions cron(백업 워크플로 패턴)이 도래 시 draft→published 전환                                                                                                        | 보류 |
| 31  | 초안 자동저장            | 작성 에디터 localStorage 디바운스 자동저장(새로고침·이탈 시 작업 유실 방지). 누적/용량 안전(키 overwrite·TTL·스윕·quota 재시도)                                                                     | 완료 |
| 32  | 관리자 피드 검색         | `/admin/feeds`에 검색 입력(기존 `searchFeeds` FTS 재사용)                                                                                                                                           | 보류 |
| 33  | 홈 구조화 데이터         | 홈에 `WebSite`/`Organization` JSON-LD(SEO 보강, 기존 structured-data 확장)                                                                                                                          | 보류 |
| 34  | 프로필 bio·아바타        | `User.bio`/`avatarUrl` 추가 + 계정 폼·`/u/[id]` 표시(기존 업로드 재사용)                                                                                                                            | 보류 |
| 35  | 핵심 컴포넌트 테스트     | `comment-section`·`comment-item`(SSE·수정·삭제)·`share-bar`·`nav-drawer` RTL 테스트                                                                                                                 | 보류 |
