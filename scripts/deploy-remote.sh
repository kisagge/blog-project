#!/bin/sh
# 운영 서버 배포 — Deploy 워크플로가 SSH로 이 파일 내용을 서버에서 실행한다(appleboy/ssh-action script_path).
# env: DEPLOY_SHA(필수, 배포할 커밋), DEPLOY_DIR(기본 /srv/byjang), DEPLOY_IMAGE(기본 ghcr.io/kisagge/blog-project)
#      DEPLOY_HEALTH_TRIES·DEPLOY_HEALTH_INTERVAL(헬스 대기 횟수·간격초, 기본 36×5s=3분)
#
# 서버의 compose.yaml은 :latest를 가리키는 손으로 복사한 파일이라 배포가 갱신하지 않는다.
# 레지스트리 :latest를 끌어오면(compose pull) 동시 머지 시 다른 실행이 올린 이미지가 섞일 수 있어,
# 이번 커밋 이미지(:sha)를 받아 로컬에서 :latest로 지정한 뒤 기동한다.
set -eu

SHA="${DEPLOY_SHA:?DEPLOY_SHA가 필요합니다}"
IMAGE="${DEPLOY_IMAGE:-ghcr.io/kisagge/blog-project}"
TRIES="${DEPLOY_HEALTH_TRIES:-36}"
INTERVAL="${DEPLOY_HEALTH_INTERVAL:-5}"
cd "${DEPLOY_DIR:-/srv/byjang}"

# compose.yaml 동기화: 워크플로가 레포의 compose.yaml을 base64로 넘긴다(DEPLOY_COMPOSE_B64).
# 서버 사본이 손으로 복사한 옛 파일이라 healthcheck·UPLOAD_DIR·로그 제한이 빠져 있었다 → 레포를 기준으로 맞춘다.
# 먼저 문법 검증 후, 다르면 기존 파일을 백업하고 diff를 남긴 뒤 교체. 값이 없으면(수동 실행) 서버 파일 그대로.
if [ -n "${DEPLOY_COMPOSE_B64:-}" ]; then
  printf '%s' "$DEPLOY_COMPOSE_B64" | base64 -d > compose.yaml.new
  if ! docker compose -f compose.yaml.new config -q; then
    rm -f compose.yaml.new
    echo "::error::레포 compose.yaml 검증 실패 — 배포 중단(서버 파일 변경 없음)"
    exit 1
  fi
  if [ -f compose.yaml ] && cmp -s compose.yaml compose.yaml.new; then
    rm -f compose.yaml.new
    echo "== compose.yaml 변경 없음 =="
  else
    backup=/dev/null
    if [ -f compose.yaml ]; then
      backup="compose.yaml.bak-$(date +%Y%m%d-%H%M%S)"
      cp compose.yaml "$backup"
    fi
    echo "== compose.yaml 갱신(이전 파일: $backup) =="
    diff -u "$backup" compose.yaml.new || true
    mv compose.yaml.new compose.yaml
  fi
fi

echo "== disk before =="
df -h / || true
# 미사용 이미지 정리(디스크 확보). 실행 중 컨테이너의 이미지는 남는다. 롤백은 레지스트리의 :sha로.
docker image prune -af

echo "== pull $IMAGE:$SHA =="
docker pull "$IMAGE:$SHA"

# 새 이미지는 기동 시 마이그레이션을 적용한다 → 그 전에 현재 DB를 백업. 백업이 실패하면 배포하지 않는다.
if [ -n "$(docker compose ps --status running -q web)" ]; then
  echo "== pre-deploy backup =="
  docker compose exec -T web sh scripts/backup-db.sh
else
  echo "::warning::web 컨테이너가 실행 중이 아니라 배포 전 백업을 건너뜀"
fi

docker tag "$IMAGE:$SHA" "$IMAGE:latest"

echo "== up =="
docker compose up -d

# 헬스 상태를 직접 폴링(compose 버전 무관). 컨테이너 상태와 healthcheck 상태를 함께 읽는다 —
# healthcheck가 없는 컨테이너(손으로 복사한 옛 서버 compose.yaml)는 .State.Health 자체가 없어
# 단순 '{{.State.Health.Status}}'는 템플릿 오류가 난다(첫 실전 배포에서 'unknown'으로 3분 대기 후 실패).
probe() {
  # healthcheck가 없을 때: 컨테이너 안에서 /api/health 직접 확인(런타임 이미지엔 curl·wget이 없어 node fetch).
  docker compose exec -T web node -e "fetch('http://127.0.0.1:3010/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1
}
status=""
i=0
while [ "$i" -lt "$TRIES" ]; do
  # shellcheck disable=SC2016 # Go 템플릿(셸 확장 아님)
  state=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$(docker compose ps -q web)" 2>/dev/null || echo "unknown unknown")
  case "$state" in
    running\ none) if probe; then status=healthy; else status=starting; fi ;;
    running\ *) status=${state#running } ;;
    unknown\ *) status=unknown ;; # 일시적 조회 실패 — 계속 대기
    *) status="exited(${state%% *})" ;; # 종료·재시작 루프 — 더 기다릴 필요 없음
  esac
  case "$status" in healthy | unhealthy | exited*) break ;; esac
  i=$((i + 1))
  sleep "$INTERVAL"
done
if [ "$status" != healthy ]; then
  echo "::error::헬스체크 실패(상태: $status) — 최근 로그:"
  docker compose logs --tail=80 web
  exit 1
fi

echo "== 기동 로그(마이그레이션 포함) =="
docker compose logs --tail=40 web
docker compose ps
echo "== deployed $SHA =="
echo "== disk after =="
df -h / || true
