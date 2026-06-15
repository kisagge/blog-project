# 회원가입 + 관리자 승인제 설계 (v1)

> 상태: 승인됨 (2026-06-10) · 구현 계획은 writing-plans로 별도 작성

## 목표

외부 사용자가 회원가입하면 **관리자 승인**을 거쳐 일반 회원이 된다. 회원은 **관리자 권한이 아니며** `/admin`에 접근할 수 없다. v1은 **가입 → 승인 → 로그인**의 인증 토대까지이며, 회원 전용 기능(댓글·좋아요·회원 피드 게시 등)은 추후 이 토대 위에 추가한다.

## 결정 사항 (브레인스토밍)

- 회원 권한 = 비관리자, `/admin` 불가, 상호작용 기능은 추후.
- **점검/비공개 모드는 admin만 통과** — 회원도 점검 중엔 차단. → `guardPublicAccess`는 변경하지 않는다(회원은 게이트와 독립).
- 가입 필드: **이메일 + 비밀번호 + 닉네임**.
- 상태: **pending / approved** 2개. **거절 = 행 삭제**(같은 이메일 재가입 가능).
- 접근법 **A**: 기존 관리자 인증(env 비번 + `/login` + proxy + guardPublicAccess)은 그대로 두고 **회원 시스템을 병렬로 추가**.
- 비밀번호 해싱: Node 내장 **`crypto.scrypt`**(무의존성 — 네이티브 모듈 회피).

## 1. 데이터 모델

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  nickname     String
  passwordHash String   // "salt:hash" (scrypt, hex)
  status       String   @default("pending")  // "pending" | "approved"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

마이그레이션 1건. 닉네임은 v1에서 비고유. (추후 Comment/Like/MemberPost가 `userId` 참조)

## 2. 비밀번호 해싱 (`lib/password.ts`)

- `hashPassword(plain)`: 랜덤 salt(16B) + `scrypt` → `"<saltHex>:<hashHex>"` 반환.
- `verifyPassword(plain, stored)`: salt 파싱 → scrypt → `timingSafeEqual`.
- 최소 길이 8자(검증은 zod에서).

## 3. 세션 확장 (`lib/jwt.ts` · `lib/session.ts` · `lib/dal.ts`)

판별 유니온 페이로드:

```ts
type SessionPayload =
  | { role: "admin"; expiresAt: string }
  | { role: "member"; userId: string; nickname: string; expiresAt: string };
```

- `createAdminSession()`(기존 `createSession` 개명) / `createMemberSession(userId, nickname)`.
- `getSession()` → 유니온 | undefined. `verifySession()`(관리자 가드) → `role !== "admin"`이면 `/login` 리다이렉트.
- ⚠️ 기존 `{ admin: true }` 세션은 무효화 → 관리자 1회 재로그인 필요(영향 적음).

## 4. 라우트 & 흐름

- **`/login`**(관리자): 비번 only, 변경 없음(proxy/verifySession 의존).
- **`/signup`**(공개): 이메일·비번·닉네임 → `signup` 액션 → zod 검증 → 이메일 중복 확인 → 해싱 → `status="pending"` 생성 → "승인 대기" 안내(자동 로그인 X).
- **`/signin`**(회원 로그인): 이메일·비번 → `memberLogin` 액션 → 사용자 조회 + 비번 검증 → `approved` 아니면 "승인 대기 중" 메시지 → 회원 세션 생성 → `/`로.
- 사이트 헤더: 비로그인 시 "로그인/가입", 회원 로그인 시 "닉네임 · 로그아웃".

## 5. 접근 제어

- `proxy.ts`: `/admin/*`는 `session?.role === "admin"`만(회원 차단). 기존 `session.admin` 체크를 교체.
- `guardPublicAccess`: **변경 없음** — 점검 모드는 admin만 통과.

## 6. 어드민 승인 UI (`/admin`)

사이트 토글 카드 아래 **"가입 대기 회원"** 섹션:
- 대기자 목록(이메일·닉네임·신청일) + **승인**/**거절** 버튼.
- 승인 회원 목록 + **삭제**(회원 제거).
- 서버 액션: `approveUser(id)`, `rejectUser(id)`(삭제), `removeUser(id)`(삭제). 모두 `verifySession()` 보호.

## 7. 테스트 (기능 동반 규칙)

- `lib/password.test.ts`: 해시/검증 라운드트립, 오답 실패, 매번 다른 salt.
- 회원 로직 테스트(임시 SQLite, `lib/test-db.ts`): 가입→pending, 승인→approved, 미승인 로그인 차단, 이메일 중복 거부.

## 8. 버전 / 보안

- feat → **0.5.0 → 0.6.0**.
- 잘못된 자격증명은 일반 메시지(이메일 존재 노출 최소화).
- **레이트리밋은 v1 범위 외**(추후 과제).

## 범위 밖 (추후)

댓글·좋아요·회원 피드 게시, 이메일 인증·알림, 비밀번호 재설정, 레이트리밋, 관리자 User 테이블 통합.
