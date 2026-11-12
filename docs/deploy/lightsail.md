# Lightsail 배포 가이드

Next.js 16 + Prisma 7(SQLite) 앱을 AWS Lightsail VPS에 Docker로 배포하고, `main` push 시 GitHub Actions로 자동 배포한다.

- 인스턴스: **Ubuntu 24.04, x86_64**
- 고정 IP(public): **3.34.242.252** (SSH·도메인·외부 접속 대상)
- private IP: 172.26.15.33 (AWS 내부용, 이번 경로 미사용)
- 이미지: `ghcr.io/kisagge/blog-project` (**public**)
- 앱 포트: 3010 (loopback 바인딩, nginx만 접근)

---

## 1. Lightsail 인스턴스 준비 (1회)

1. Lightsail에서 Ubuntu 24.04 인스턴스 생성(2GB RAM 이상 권장).
2. **고정 IP** 생성 후 인스턴스에 연결 → `3.34.242.252`.
3. 방화벽(Networking): TCP **22, 80, 443** 허용.
4. 도메인 DNS의 A 레코드 → `3.34.242.252`.

## 2. 서버 패키지 설치 (SSH 접속 후)

```bash
sudo apt update && sudo apt install -y nginx
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER     # 적용 위해 재로그인
sudo apt install -y certbot python3-certbot-nginx
```

## 3. 앱 디렉토리 + 시크릿

```bash
sudo mkdir -p /srv/byjang/data && sudo chown -R $USER:$USER /srv/byjang
cd /srv/byjang
# 레포의 compose.yaml 내용을 이 위치에 복사 (scp 또는 붙여넣기)
#   scp compose.yaml ubuntu@3.34.242.252:/srv/byjang/

# 중요: 컨테이너는 비루트 유저(nextjs, uid 999)로 돈다. SQLite 파일(/data/prod.db)을
# 쓰려면 호스트 data 디렉토리를 그 uid로 넘겨야 한다(안 하면 migrate가
# "unable to open database file: /data/prod.db"로 실패).
sudo chown -R 999:999 /srv/byjang/data

# 런타임 시크릿(.env) — DATABASE_URL/NODE_ENV는 compose가 지정하므로 여기엔 둘만
cat > .env <<EOF
ADMIN_PASSWORD=원하는_관리자_비밀번호
SESSION_SECRET=$(openssl rand -base64 32)
EOF
chmod 600 .env
```

## 4. 배포용 SSH 키 (GitHub Actions → 서버)

```bash
# 서버에서 생성
ssh-keygen -t ed25519 -f ~/deploy_key -N ""
cat ~/deploy_key.pub >> ~/.ssh/authorized_keys
cat ~/deploy_key            # 이 개인키 전체를 복사해 GitHub Secret SSH_KEY로 등록
```

GitHub 저장소 → Settings → Secrets and variables → Actions에 등록:

| Secret     | 값                                         |
| ---------- | ------------------------------------------ |
| `SSH_HOST` | `3.34.242.252`                             |
| `SSH_USER` | `ubuntu`                                   |
| `SSH_KEY`  | `deploy_key` 개인키 전체(`-----BEGIN ...`) |

> GHCR 이미지가 public이라 서버 레지스트리 로그인은 불필요하다.

## 5. 첫 배포

1. `main`에 push(또는 Actions 탭에서 `Deploy` 워크플로 `Run workflow`).
2. `test` → `build-and-push`(GHCR로 이미지) → `deploy`(서버 SSH) 순서로 실행.
3. **이미지 가시성 public 전환** (최초 1회): GitHub 프로필/조직 → Packages → `blog-project` → Package settings → Change visibility → **Public**.
   - 이전에 push된 이미지가 private면 서버 `docker compose pull`이 실패하므로 public 전환 후 재실행.
4. 서버에서 컨테이너 확인:
   ```bash
   cd /srv/byjang && docker compose ps && docker compose logs --tail=30 web
   curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3010/feed   # 200
   ```

## 6. nginx 리버스 프록시 + HTTPS

`/etc/nginx/sites-available/byjang`:

```nginx
server {
  server_name your-domain.com;
  # 업로드 이미지는 볼륨에서 직접 서빙 (앱을 거치지 않음)
  location /uploads/ {
    alias /srv/byjang/data/uploads/;
    expires 30d;
    access_log off;
  }
  location / {
    proxy_pass http://127.0.0.1:3010;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

> **클라이언트 IP 판별 전제**: 앱은 `X-Forwarded-For`의 **마지막 항목**(nginx `$proxy_add_x_forwarded_for`가 덧붙인 실제 원격 주소)을 IP로 쓴다(`lib/forwarded-ip.ts`). 첫 항목은 클라이언트가 위조할 수 있기 때문. 이 전제는 **nginx 1홉 + 앱 포트 loopback 바인딩**(`127.0.0.1:3010`)에서만 성립하므로, 앞단에 Cloudflare 프록시·CDN·로드밸런서를 추가하면 모든 사용자가 그 프록시 IP 하나로 묶인다 — 그때는 nginx `real_ip`(set_real_ip_from)로 실제 IP를 복원하거나 판별 로직을 함께 바꿀 것.

> **실시간 알림(SSE, `/api/events`)**: nginx 추가 설정 불필요. 앱이 응답에 `X-Accel-Buffering: no`를 보내 버퍼링을 끄고 25초 하트비트로 idle 타임아웃을 피한다. (장시간 SSE가 끊기면 `proxy_read_timeout`을 늘릴 수 있으나 하트비트로 충분.) 단일 컨테이너 인메모리 버스라 다중 인스턴스로 확장 시엔 외부 pub/sub 필요.

```bash
# 최초 1회: 업로드 디렉토리 생성 + 컨테이너 uid(999=nextjs)에 소유권 부여
sudo mkdir -p /srv/byjang/data/uploads
sudo chown -R 999:999 /srv/byjang/data/uploads

sudo ln -s /etc/nginx/sites-available/byjang /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com    # Let's Encrypt 발급 + 자동 갱신(systemd timer)
```

> `/uploads` location을 추가했다면 **반드시 `nginx -t && systemctl reload nginx`**. 빠지면 업로드 이미지가 404.

### 6-1. HTTP/2 활성화 (필수)

certbot이 만드는 443 블록은 `listen 443 ssl;`뿐이라 **HTTP/1.1로 서빙**된다. 글 상세는 SSE 연결 2개(알림 `/api/events`·실시간 댓글 `/api/feed-events`)를 유지하므로, HTTP/1.1에선 브라우저의 **호스트당 6연결 한도**에 글 탭 3개 정도면 닿아 다음 탭·요청이 "Loading"에서 멈춘다. HTTP/2는 연결 하나에 요청을 다중화해 이 한도가 사실상 사라진다(앱↔nginx 구간은 `proxy_http_version 1.1` 그대로 — 로컬 연결이라 무관).

```bash
# sites-enabled 항목은 심볼릭 링크 → grep은 -R(대문자)로, sed는 링크가 아닌 실제 파일에(링크를 덮어쓰지 않게)
sudo grep -Rn "listen.*443\|http2" /etc/nginx/sites-enabled/
F=$(readlink -f /etc/nginx/sites-enabled/byjang)
sudo cp "$F" "$F.bak-$(date +%F)"

# nginx < 1.25.1 (Ubuntu 22.04의 1.18, 24.04의 1.24): listen 지시어에 http2
sudo sed -i -E 's/(listen\s+(\[::\]:)?443\s+ssl)([ ;])/\1 http2\3/' "$F"
# nginx ≥ 1.25.1이면 위 대신 443 server 블록에 `http2 on;` 한 줄 추가

grep -n "listen.*443\|http2" "$F"      # → listen 443 ssl http2; # managed by Certbot
sudo nginx -t && sudo systemctl reload nginx
curl -sI --http2 https://your-domain.com -o /dev/null -w '%{http_version}\n'   # 2
```

- certbot 자동 갱신은 `listen` 줄을 다시 쓰지 않으므로 한 번만 하면 된다.
- 되돌리기: `sudo cp "$F.bak-<날짜>" "$F" && sudo nginx -t && sudo systemctl reload nginx`.
- SSE는 HTTP/2에서도 추가 설정 없이 동작(아래 버퍼링·하트비트 설명과 동일).

확인: `https://your-domain.com/feed` 200, `https://your-domain.com/admin` 로그인 동작
(HTTPS 종단이라 세션 쿠키 `secure:true` 정상).

## 7. 운영

- **로그**: `docker compose logs -f web`
- **수동 업데이트**: `docker compose pull && docker compose up -d`
- **롤백**: `compose.yaml`의 `image` 태그를 `ghcr.io/kisagge/blog-project:<원하는 sha>`로 바꾸고 `docker compose up -d`.
- **DB 백업**: 매일 04:00 KST `DB Backup` 워크플로가 서버 로컬 백업(`/srv/byjang/data/backups`, 14일 회전)을 만들고, **암호화한 사본을 GitHub 아티팩트로 90일 보관**(오프사이트 — 아래 7-1). 즉석 수동 백업: `cp /srv/byjang/data/prod.db /srv/byjang/data/prod.db.$(date +%F)`.

### 7-1. 오프사이트 백업 (암호화 아티팩트)

저장소가 **공개**라 아티팩트는 로그인한 누구나 받을 수 있다 → [age](https://age-encryption.org) **공개키로 암호화**해 올리고, 복호화용 **개인키는 운영자만** 보관한다(CI엔 공개키만 있음).

**최초 1회 — 키 만들기·등록** (로컬 PC):

```bash
brew install age                              # macOS (리눅스: apt install age)
age-keygen -o ~/byjang-backup-key.txt         # 개인키 파일 생성 — 비밀번호 관리자·오프라인 저장소에 따로 보관
grep '^# public key:' ~/byjang-backup-key.txt # → age1... (공개키)
gh secret set BACKUP_AGE_RECIPIENT --body 'age1...'   # 공개키만 GitHub Secret으로
gh workflow run backup.yml                    # 즉시 1회 실행해 확인
```

> 개인키를 잃으면 모든 오프사이트 사본을 열 수 없다. **개인키를 서버나 저장소에 두지 말 것.** 시크릿이 없으면 워크플로는 경고만 남기고 서버 로컬 백업은 정상 수행한다.

**복원**:

```bash
gh run list --workflow backup.yml --limit 5   # 원하는 날짜의 실행 ID
gh run download <run-id> -D restore/          # restore/db-backup-prod-YYYYMMDD-HHMMSS.db.gz/…​.age
age -d -i ~/byjang-backup-key.txt -o prod.db.gz restore/*/prod-*.db.gz.age
gunzip prod.db.gz && sqlite3 prod.db 'PRAGMA integrity_check;'   # → ok
# 서버 교체: docker compose stop web → /srv/byjang/data/prod.db 덮어쓰기(+ -wal/-shm 삭제) → docker compose start web
```

- 정기 점검: 분기마다 한 번 위 복원 절차로 최신 사본이 열리는지(`integrity_check` = ok) 확인 권장.
- **마이그레이션**: 새 마이그레이션이 포함된 이미지가 뜨면 컨테이너 entrypoint의 `prisma migrate deploy`가 자동 적용.

## 트러블슈팅

- `deploy` job만 실패: `SSH_HOST/SSH_USER/SSH_KEY` 시크릿 누락/오타, 또는 서버 방화벽 22 차단 확인.
- `docker compose pull` 권한 오류: 이미지가 아직 private → 5-3 public 전환.
- 로그인 후 바로 로그아웃됨: HTTPS 미적용 상태에서 `secure` 쿠키가 안 붙는 경우 → nginx+certbot로 HTTPS 적용 필요.
- 컨테이너가 migrate에서 종료: `.env`의 권한/값, `/srv/byjang/data` 쓰기 권한 확인.
- 글 탭을 여러 개 열면 새 탭이 "Loading"에서 멈춤: HTTP/1.1 서빙으로 SSE 연결이 호스트당 6연결 한도를 채운 상태 → 6-1 HTTP/2 활성화. 확인: `curl -sI https://your-domain.com -o /dev/null -w '%{http_version}\n'`이 `2`.
