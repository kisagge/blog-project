# 설계: 피드 본문 이미지 업로드

- 작성일: 2026-06-08
- 전제: Next.js 16 + Prisma 7(SQLite), 관리자 인증(/admin, Server Action CRUD), 본문 마크다운(react-markdown). 배포: Lightsail Docker(`/srv/byjang/data` 볼륨, `next start`), nginx + HTTPS.

## 목표

관리자가 글 작성/수정 폼에서 이미지를 업로드해 **본문 마크다운에 `![](url)`로 삽입**한다. 파일은 서버 볼륨에 저장하고 nginx가 서빙한다.

## 결정 사항 (브레인스토밍 합의)

- 저장: **서버 볼륨** (`/data/uploads`, 호스트 `/srv/byjang/data/uploads`).
- 용도: **본문 삽입** (대표 이미지 필드 없음 → 스키마 변경 없음).
- 형식: **jpg/jpeg/png/webp** (gif 제외).
- 크기: **최대 5MB**.
- 업로드: 관리자만(verifySession).

## 1. 저장 & 서빙

- 업로드 파일은 `/data/uploads/<uuid>.<ext>`로 저장(컨테이너 기준). 볼륨이라 영속.
- **프로덕션 서빙**: nginx가 `/uploads/`를 호스트 볼륨에서 직접 서빙(컨테이너 우회, 빠름):
  ```nginx
  location /uploads/ {
    alias /srv/byjang/data/uploads/;
    expires 30d;
    access_log off;
  }
  ```
- **로컬 dev 서빙**: `next dev`엔 nginx가 없으므로, Next **Route Handler** `app/uploads/[name]/route.ts`가 `data/uploads`의 파일을 스트리밍(프로덕션에선 nginx가 먼저 가로채므로 미사용). → dev/prod 모두 `/uploads/<name>` URL 동일.

## 2. 업로드 Server Action — `app/admin/upload-action.ts`

```
uploadImage(formData): Promise<{ url } | { error }>
```

- `verifySession()` (관리자 아니면 거부).
- `file = formData.get("file") as File`.
- 검증: MIME·확장자 화이트리스트(jpg/jpeg/png/webp), `file.size <= 5MB`.
- `uuid` + 원확장자로 파일명 생성, `await fs.writeFile(path, Buffer.from(await file.arrayBuffer()))`.
- 저장 경로: `process.env.UPLOAD_DIR ?? "data/uploads"` (컨테이너에선 `/data/uploads`로 설정).
- 반환: `{ url: "/uploads/<uuid>.<ext>" }`. 실패 시 `{ error }`.

## 3. 작성 폼 UX — `app/admin/feed-form.tsx`

- "이미지 첨부" `<input type="file" accept="image/jpeg,image/png,image/webp">` 추가.
- 선택 시 client에서 `uploadImage` 호출(FormData) → 반환 URL을 **본문 `<textarea>`의 커서 위치(없으면 끝)에 `![](url)\n` 삽입**.
- 업로드 중 버튼 비활성/스피너, 실패 시 에러 메시지.
- 본문 textarea는 ref로 제어해 삽입(현재 defaultValue 방식 → 제어 or ref 보강).

## 4. 렌더링

- 본문은 이미 `react-markdown` → `![](url)`이 `<img>`로 렌더됨(코드 변경 거의 없음).
- 상세 페이지 본문 컨테이너에 `[&_img]:max-w-full [&_img]:rounded` 정도 스타일 보강(이미지 넘침 방지).

## 5. 설정 / 배포

- `next.config.ts`: `experimental.serverActions.bodySizeLimit: "6mb"` (5MB 파일 + 폼 오버헤드 여유).
- `compose.yaml`: `UPLOAD_DIR=/data/uploads` 환경변수(이미 `/data` 볼륨 마운트됨). 컨테이너 시작 시 `mkdir -p`.
- 호스트 `uploads` 디렉토리 권한: 컨테이너 uid(999)가 쓰게 `chown`(배포 가이드에 추가).
- **nginx에 `/uploads` location 추가**(배포 가이드 문서화 + 수동 적용).
- `.gitignore`/`.dockerignore`: 로컬 `data/uploads` 제외.

## 6. 보안

- 업로드는 `verifySession`으로 관리자만.
- 형식 화이트리스트 + 크기 제한으로 악성/대용량 차단.
- 파일명은 `uuid`로 생성(경로 조작·덮어쓰기 방지). 원본 파일명 사용 안 함.
- Route Handler(dev)에서 `..` 경로 차단(파일명 검증).

## 7. 검증

- 단위(Vitest): 업로드 검증 로직(형식/크기 화이트리스트) 순수 함수로 분리해 테스트.
- 수동: 로컬 dev에서 업로드 → 본문 삽입 → 상세 렌더 확인. 배포 후 nginx `/uploads` 서빙 확인.
- `tsc`/`eslint`/`vitest`/`build` 게이트.

## 범위 제외 (YAGNI)

- 이미지 리사이즈/썸네일 생성, EXIF 제거, 외부 스토리지/CDN, 드래그앤드롭·붙여넣기 업로드, 업로드 목록/삭제 관리 UI(우선 삽입만).
