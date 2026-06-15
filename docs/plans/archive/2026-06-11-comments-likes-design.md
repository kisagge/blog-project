# 회원 댓글(2뎁스) + 좋아요 설계 (v1)

> 상태: 승인됨 (2026-06-11) · 구현 계획은 writing-plans로 별도 작성

## 목표

공개 피드 상세에서 **승인 회원·관리자**가 댓글(댓글→대댓글 2뎁스)과 좋아요를 남긴다. 비로그인 방문자가 댓글/좋아요를 시도하면 로그인 유도 모달을 띄운다.

## 결정 사항 (브레인스토밍)

- 작성 주체: **승인 회원 + 관리자**. (미승인 회원은 애초에 로그인 불가 → 로그인된 member는 항상 승인 회원)
- 관리자 작성: 관리자는 User 레코드가 없으므로 **예약 admin User(싱글톤)** 를 두어 `Comment.userId`가 항상 User를 가리킨다. 관리자 댓글 표시 이름 = 그 User의 nickname, **`/admin/settings`에서 편집**(기본 "관리자").
- 댓글 깊이: 댓글 → 대댓글 **2뎁스까지만**.
- 삭제 권한: **본인 + 관리자(모든 댓글)**. 수정 없음.
- 삭제 처리: 대댓글이 있으면 **soft-delete(tombstone "삭제된 댓글입니다")**, 없으면 hard-delete.
- 정렬: 상위 댓글 **최신순**, 대댓글 시간순. 전체 표시(페이지네이션 추후).
- 좋아요: 피드별 토글, `(feedId,userId)` unique.
- 비로그인 시도: **네이티브 `<dialog>` 로그인 유도 모달**(로그인/가입 링크).
- 댓글 내용: **평문**(마크다운/HTML 렌더 안 함 — XSS 방지). 1~1000자.

## 1. 데이터 모델

```prisma
model Comment {
  id        String    @id @default(uuid())
  feedId    String
  userId    String
  parentId  String?   // null=상위, 값=대댓글
  content   String
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  feed      Feed      @relation(fields: [feedId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id])
  parent    Comment?  @relation("replies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   Comment[] @relation("replies")
}

model Like {
  id        String   @id @default(uuid())
  feedId    String
  userId    String
  createdAt DateTime @default(now())
  feed      Feed     @relation(fields: [feedId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id])
  @@unique([feedId, userId])
}
```

`Feed`에 `comments Comment[]` / `likes Like[]`, `User`에 `comments`/`likes` 역참조 추가. 마이그레이션 1건.

## 2. 작성자 신원

- **예약 admin User**: email `admin@byjang.local`(예약), nickname 기본 "관리자", status `approved`, passwordHash는 로그인 불가 sentinel(`"-"` 등 `salt:hash` 형식 아님). 회원 목록/카운트(`listUsersByStatus`/`countUsersByStatus`)에서 이 이메일 제외.
- `lib/comment-actor.ts`(또는 dal 확장) `getCommentActor()`:
  - member → `{ userId, nickname }`
  - admin → `ensureAdminUser()`(upsert) 후 `{ userId, nickname }`
  - anon → `null`
- `getAdminNickname()` / `setAdminNickname(name)`: 예약 admin User upsert·nickname 갱신. `/admin/settings`에서 사용.

## 3. 서버 액션 (모두 actor 검증, anon 거부)

- `addComment(feedId, content, parentId?)`: zod(1~1000자). parentId 있으면 부모가 **같은 feed의 상위 댓글**인지 확인(2뎁스 강제). 생성 후 `revalidatePath("/feed/[slug]","page")` 또는 slug 경로.
- `deleteComment(id)`: 작성자 본인 또는 admin만. replies 있으면 `deletedAt` 설정(내용 가림), 없으면 삭제.
- `toggleLike(feedId)`: `(feedId,userId)` 있으면 삭제, 없으면 생성.
- `setAdminNickname(nickname)`: verifySession(admin) 후 예약 User nickname 갱신.

## 4. 데이터 조회

- `getFeedComments(feedId)`: 전체 로드(작성자 nickname, replies) → 트리(상위 최신순/대댓글 시간순). tombstone은 content 숨김 + 플래그.
- `getLikeSummary(feedId, actorUserId?)`: `{ count, liked }`.

## 5. 화면 (`/feed/[slug]` 하단)

- `FeedArticle` 아래: **좋아요 버튼**(하트+카운트, liked 상태) + **댓글 섹션**(작성 폼 + 목록).
- 상세(서버)가 세션으로 `canParticipate = role==='member'||'admin'`, `actorUserId`를 계산해 클라이언트에 전달.
- 클라이언트 컴포넌트: 좋아요 버튼, 댓글/답글 폼, 삭제 버튼. anon이면 액션 대신 **로그인 모달**.
- 각 상위 댓글에 "답글" 토글 → 대댓글 폼(대댓글엔 답글 없음).

## 6. 관리자 설정

- `/admin/settings`에 "관리자 닉네임" 폼 추가(현재 값 표시 + 저장). `setAdminNickname` 액션.

## 7. 테스트 (임시 SQLite)

- 댓글 생성/조회 트리, **2뎁스 초과(대댓글에 답글) 거부**, soft/hard 삭제 분기, 권한(타인 삭제 거부·admin 허용), 좋아요 토글·unique·카운트, 관리자 닉네임 설정.

## 8. 버전 / 범위 밖

- feat → **0.8.0 → 0.9.0**.
- 범위 밖: 댓글 수정, 좋아요 누른 사람 목록, 알림, 멘션, 댓글 페이지네이션.
