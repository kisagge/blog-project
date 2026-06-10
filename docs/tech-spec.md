# 기술 개요 — BY Playground

개인 블로그(공개 피드 + 관리자)를 직접 설계·구현하고 자체 서버(AWS Lightsail)에 Docker로 배포·운영한 프로젝트. 개발부터 CI/CD, 인프라 운영까지 1인이 담당.

> 영문: [tech-spec.en.md](tech-spec.en.md)

## 1. 요약

- **유형**: 개인 풀스택 웹앱 (공개 피드 + 관리자 CMS)
- **스택**: Next.js 16 (App Router · Server Actions) · React 19 · Prisma 7 + SQLite · Tailwind v4 · TypeScript
- **인프라**: Docker · AWS Lightsail · nginx · GitHub Actions (CI/CD)
- **규모**: 단일 저장소, SQLite 단일 DB, 컨테이너 1개로 운영하는 경량 구성

## 2. 아키텍처

```
방문자 ── HTTPS ──> nginx ──┬─ /uploads/*  → 디스크 볼륨에서 직접 서빙(정적)
                            └─ /*          → Next.js (next start, :3010, loopback)
                                                 │
                                  Server Actions / RSC
                                                 │
                                  Prisma 7 (드라이버 어댑터) → SQLite (/data/prod.db)

CI/CD: main push → GitHub Actions
        test(tsc·eslint·vitest) → 이미지 빌드·GHCR 푸시 → SSH 배포(pull & compose up)
```

- **렌더링**: 공개 피드는 첫 페이지를 서버 렌더(SEO·초기 응답), 이후 클라이언트가 Server Action으로 증분 로드.
- **인증**: jose로 서명한 JWT 세션 쿠키. `proxy.ts`(Next 16 미들웨어)가 `/admin`을 보호.
- **파일**: 업로드 이미지는 볼륨에 저장하고 nginx가 앱을 거치지 않고 직접 서빙.

## 3. 기술 스택

| 영역       | 기술                            | 버전       | 선택 이유                                                              |
| ---------- | ------------------------------- | ---------- | ---------------------------------------------------------------------- |
| 프레임워크 | Next.js (App Router)            | 16.2.7     | Server Actions·RSC로 API 레이어 없이 데이터 변경 처리                  |
| UI         | React / Tailwind CSS            | 19.2 / v4  | —                                                                      |
| ORM/DB     | Prisma / SQLite                 | 7.8 / —    | 드라이버 어댑터(better-sqlite3 12.10)로 런타임 쿼리 엔진 바이너리 제거 |
| 인증       | jose (JWT)                      | 6.2        | 미들웨어(엣지)에서도 검증 가능한 경량 서명                             |
| 콘텐츠     | react-markdown + remark-gfm     | 10.1 / 4.0 | 본문 마크다운 렌더                                                     |
| 검증       | zod                             | 4.4        | 폼·업로드 입력 검증                                                    |
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
- **배포 워크플로**: `test → build/push(GHCR) → SSH 배포`. 수동 트리거(workflow_dispatch) 지원, `script_stop`/타임아웃으로 실패 가시화.

### 4.3 Prisma 7 드라이버 어댑터

Prisma 7이 내장 쿼리 엔진을 제거함에 따라 `@prisma/adapter-better-sqlite3` 드라이버 어댑터를 도입. 런타임 쿼리에 Rust 엔진 바이너리가 불필요해져 4.1의 이미지 슬림화와 함께 의존성·크기를 추가로 절감.

### 4.4 점검(maintenance) 모드

관리자가 공개 사이트를 외부 방문자에게 on/off 하는 기능. 싱글톤 설정 테이블 + 가드 유틸로 구현.

- 가드를 페이지가 아닌 **레이아웃**에 두어 `loading.tsx`의 Suspense 경계보다 먼저 실행 → 점검 중 비어드민을 **스켈레톤 깜빡임 없이 깔끔한 307**로 `/maintenance` 리다이렉트.
- 무한스크롤 Server Action에도 동일 가드를 적용해 데이터 노출 차단.

### 4.5 피드 검색 + 무한스크롤

제목·본문·요약 부분일치 검색과 10개 단위 무한스크롤을 결합.

- `take+1` 조회로 추가 count 쿼리 없이 다음 페이지 존재 여부 판단.
- 검색은 300ms 디바운스, **요청 시퀀스(reqId)로 빠른 타이핑 시 늦게 온 응답을 폐기**해 레이스 컨디션 방지. `?q=` URL 동기화로 결과 공유 가능.

### 4.6 테스트 전략

DB 로직은 prisma 호출을 mock하면 동어반복이 되므로, **임시 SQLite에 실제 쿼리를 돌려** 검증하는 통합 테스트 헬퍼(`lib/test-db.ts`)를 만들고 페이지네이션·검색·설정 토글을 커버. 전체 17 → 28 테스트.

## 5. 성과 요약

- 런타임 이미지 **2.05GB → 876MB (−57%)**, 배포 첫 pull **10분 32초 → 37초**
- 운영 장애(디스크 고갈·OOM) 원인 규명 및 해소 → 배포 성공률·안정성 확보
- Prisma 7 드라이버 어댑터 도입으로 런타임 엔진 바이너리 제거
- 통합 테스트 도입(17 → 28), CI에서 타입체크·린트·테스트·이미지 빌드 게이트
- 기능 단위 PR + 자동 배포 + pre-1.0 semver 버전 관리로 변경 이력 정리
