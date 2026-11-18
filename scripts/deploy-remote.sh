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

# compose 버전에 상관없이 동작하도록 healthcheck 상태를 직접 폴링(compose.yaml의 /api/health 핑).
status=""
i=0
while [ "$i" -lt "$TRIES" ]; do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q web)" 2>/dev/null || echo unknown)
  [ "$status" = healthy ] || [ "$status" = unhealthy ] && break
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
