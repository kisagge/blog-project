#!/usr/bin/env bash
# git에 올라가지 않는 개발 환경설정 파일을 모아 압축한다(다른 PC 셋업용).
# 실행: pnpm pack:config   (또는 bash scripts/pack-config.sh)
# 복원: 다른 PC의 저장소 루트에서  tar -xzf byjang-config-*.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."

# 담을 후보(존재하고 + git에 무시되는 것만 포함 → 추적 중인 파일은 절대 안 담음).
CANDIDATES=(
  .env
  .env.local
  .env.development
  .env.development.local
  .env.production
  .env.production.local
)

files=()
for f in "${CANDIDATES[@]}"; do
  if [ -f "$f" ] && git check-ignore -q "$f" 2>/dev/null; then
    files+=("$f")
  fi
done

if [ ${#files[@]} -eq 0 ]; then
  echo "담을 환경설정 파일이 없습니다 (.env 등)."
  exit 0
fi

out="byjang-config-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$out" "${files[@]}"

echo "생성: $out"
printf '  - %s\n' "${files[@]}"
echo "복원: 대상 PC 저장소 루트에서  tar -xzf $out"
