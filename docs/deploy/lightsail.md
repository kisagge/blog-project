# Lightsail 배포 가이드

Next.js 16 + Prisma 7(SQLite) 앱을 AWS Lightsail VPS에 Docker로 배포하고, `main` push 시 GitHub Actions로 자동 배포한다.

- 인스턴스: **Ubuntu 24.04, x86_64**
- 고정 IP(public): **3.34.132.108** (SSH·도메인·외부 접속 대상)
- private IP: 172.26.15.33 (AWS 내부용, 이번 경로 미사용)
- 이미지: `ghcr.io/kisagge/blog-project` (**public**)
- 앱 포트: 3010 (loopback 바인딩, nginx만 접근)

---

## 1. Lightsail 인스턴스 준비 (1회)

1. Lightsail에서 Ubuntu 24.04 인스턴스 생성(2GB RAM 이상 권장).
2. **고정 IP** 생성 후 인스턴스에 연결 → `3.34.132.108`.
3. 방화벽(Networking): TCP **22, 80, 443** 허용.
4. 도메인 DNS의 A 레코드 → `3.34.132.108`.

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
#   scp compose.yaml ubuntu@3.34.132.108:/srv/byjang/

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

| Secret | 값 |
| --- | --- |
| `SSH_HOST` | `3.34.132.108` |
| `SSH_USER` | `ubuntu` |
| `SSH_KEY` | `deploy_key` 개인키 전체(`-----BEGIN ...`) |

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
```bash
sudo ln -s /etc/nginx/sites-available/byjang /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com    # Let's Encrypt 발급 + 자동 갱신(systemd timer)
```

확인: `https://your-domain.com/feed` 200, `https://your-domain.com/admin` 로그인 동작
(HTTPS 종단이라 세션 쿠키 `secure:true` 정상).

## 7. 운영

- **로그**: `docker compose logs -f web`
- **수동 업데이트**: `docker compose pull && docker compose up -d`
- **롤백**: `compose.yaml`의 `image` 태그를 `ghcr.io/kisagge/blog-project:<원하는 sha>`로 바꾸고 `docker compose up -d`.
- **DB 백업**: `cp /srv/byjang/data/prod.db /srv/byjang/data/prod.db.$(date +%F)` (볼륨에 영속).
- **마이그레이션**: 새 마이그레이션이 포함된 이미지가 뜨면 컨테이너 entrypoint의 `prisma migrate deploy`가 자동 적용.

## 트러블슈팅

- `deploy` job만 실패: `SSH_HOST/SSH_USER/SSH_KEY` 시크릿 누락/오타, 또는 서버 방화벽 22 차단 확인.
- `docker compose pull` 권한 오류: 이미지가 아직 private → 5-3 public 전환.
- 로그인 후 바로 로그아웃됨: HTTPS 미적용 상태에서 `secure` 쿠키가 안 붙는 경우 → nginx+certbot로 HTTPS 적용 필요.
- 컨테이너가 migrate에서 종료: `.env`의 권한/값, `/srv/byjang/data` 쓰기 권한 확인.
