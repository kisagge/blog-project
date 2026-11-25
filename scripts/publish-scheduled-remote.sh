#!/bin/sh
# 예약 글 즉시 발행 트리거 — GitHub Actions(publish-scheduled.yml)가 SSH로 서버에서 실행(script_path).
# 정시 발행은 앱 내부 스케줄러가 담당하고, 이건 필요할 때 손으로 당기는 수동 백업.
# env: DEPLOY_DIR(기본 /srv/byjang). 서버 .env에 CRON_SECRET이 없으면 건너뜀(성공 종료).
set -eu
cd "${DEPLOY_DIR:-/srv/byjang}"

# .env에서 KEY의 값(dotenv처럼 마지막 정의가 이김). 'export ' 접두사·앞뒤 따옴표·CRLF(\r)를 걷어낸다.
# 예전 grep|cut|tr 한 줄은 CRLF면 \r이 붙은 채 보내 401, 작은따옴표·export·중복 정의도 깨졌다.
env_value() {
  sed -n "s/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}$1=//p" .env |
    tail -n 1 |
    tr -d '\r' |
    sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

SECRET=$(env_value CRON_SECRET)
if [ -z "$SECRET" ]; then
  echo "CRON_SECRET 미설정 — 건너뜀"
  exit 0
fi
curl -fsS -X POST -H "x-cron-secret: $SECRET" \
  http://127.0.0.1:3010/api/cron/publish-scheduled
