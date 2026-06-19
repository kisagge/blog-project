# 회원 글 작성 설계 — 임시저장 → 회원공개

**목표:** 승인 회원이 자기 글을 작성해 **회원공개**할 수 있게 한다. 작성 중인 글은 **임시저장(draft)** 버퍼(동시 최대 3개)로 두어 미완성 글이 공간을 차지하지 않게 한다.

**핵심 결정 요약**

- 회원 글은 **기존 `Feed`를 재사용**한다(상세·댓글·좋아요·조회수·공개범위 인프라 공유). "피드와 같은 게시물"이라는 방향과 일치하며, 알림의 "글 주인" 일반화는 이미 깔린 선수작업이다.
- 회원 글의 공개범위는 **회원공개(`members`) 고정** — 전체공개(외부 노출)·비공개 없음.
- 작성 단계는 별도 `status`(`draft`/`published`)로 관리한다. "누가 보나(visibility)"와 "작성 단계(status)"를 분리해야, 이전에 추가한 "관리자는 자기 비공개 글을 목록에서 본다" 기능과 충돌하지 않는다(회원 draft가 관리자 `/feed`에 쏟아지지 않음).
- **이미지 업로드 없음** — 외부 이미지 URL 마크다운(`![](https://…)`)만. 업로드 액션은 관리자 전용 유지. `rehype-raw` 미사용이라 원시 HTML은 이스케이프되어 XSS 안전.

## 데이터 모델

`Feed`에 컬럼 추가:

| 컬럼          | 타입        | 의미                                             |
| ------------- | ----------- | ------------------------------------------------ |
| `authorId`    | `String?`   | `null`=관리자/기존 글, 값=회원 작성자(User.id)   |
| `status`      | `String`    | `"draft"` \| `"published"` (기본 `published`)    |
| `publishedAt` | `DateTime?` | 게시(공개 전환) 시각. 하루 게시 제한·표시에 사용 |

- `author User? @relation(onDelete: Cascade)` — 회원 삭제 시 그 회원의 글도 삭제.
- `@@index([authorId, status])`.
- 기존 글·관리자 글은 전부 `authorId=null, status=published`라 동작 불변.

**상태 전이**

- 임시저장 생성: `status=draft, visibility=members, authorId=me` (현재 내 draft < 3일 때만).
- 게시: `draft→published`, `publishedAt=now`. 임시저장 슬롯 반환.
- 바로 게시(임시저장 거치지 않음): `status=published` 생성. draft 슬롯 미점유.
- 게시 글은 되돌리지 않음(언게시 없음). 수정·삭제는 가능.

## 제약·가드 (서버 강제)

- **임시저장 한도**: `count(authorId=me, status=draft) ≤ 3`. 초과 시 새 임시저장 거부.
- **하루 게시 제한**: `count(authorId=me, status=published, publishedAt≥오늘0시 KST) ≥ N`이면 게시 거부(N=기본 5). 총 개수 상한은 없음.
- **본문 길이 상한**: 2만 자. 제목 상한: 기존 규칙 준수.
- **공개범위 강제**: 회원 액션은 항상 `visibility=members`로 저장(폼 값 무시).
- **slug**: 게시 시 제목 기반 + 짧은 난수로 서버 생성(충돌·악용 방지). 회원은 slug 직접 입력 불가.

## 접근 제어

- `published`(members) 글: 기존 `checkAccess("members", role)` 그대로 — 로그인 회원·관리자 열람.
- `draft` 글: 작성자 본인(또는 관리자)만. 공개 `/feed/[slug]`에서 draft는 비작성자에게 404. 관리·수정은 `authorId=me` 스코프 액션으로만.
- **목록은 모두 `status=published`만 조회** → draft는 누구에게도(관리자 포함) 목록 노출 안 됨.
  - `searchFeeds`(공개 목록): `status=published` 추가.
  - `getAdminFeedsPage`/`countFeeds`(관리자 CMS): `authorId=null`로 한정 → 관리자 화면은 기존처럼 관리자 글만.

## 알림 일반화

- `notifyFeedComment` 수신자 = `feed.authorId ?? 예약관리자`. (본인 댓글이면 제외) 답글 알림은 기존대로 부모 댓글 작성자.

## UI

- **작성기**: 회원에게 "글쓰기" 진입. 폼(제목·본문 마크다운). 액션 두 개 — "임시저장"(≤3), "게시(회원공개)".
- **`/account` 확장**: "내 임시저장"(편집·삭제·게시) + "내 글(회원공개)"(수정·삭제) 목록.
- **상세**: 작성자 닉네임 표시(관리자 글은 사이트 작성자).
- 접근성: 폼 `label` 연결·에러 `role="alert"`, 목록 시맨틱 `ul/ol`, 한도 초과 안내 `aria-live`.

## 슬라이스(PR)

1. **기반(이번 PR)**: 스키마(`authorId`·`status`·`publishedAt`) + 목록 `status=published`/`authorId=null` 필터 + 알림 수신자 일반화. 사용자 노출 변화 없음, 테스트 포함.
2. **작성+관리**: 회원 작성 액션(임시저장·게시 가드) + 작성기 폼 + `/account` 목록(편집·삭제·게시) + 작성자 표시 + 접근 제어(draft 본인 한정).

## 테스트

- 임시 SQLite 통합: draft는 `searchFeeds`에 미노출 / 관리자 목록은 `authorId=null`만 / 임시저장 3개 한도 / 하루 게시 제한 / 게시 시 `publishedAt` 기록 / `notifyFeedComment`가 `authorId`에게 전달.
