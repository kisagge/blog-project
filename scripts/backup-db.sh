#!/bin/sh
# SQLite DB 로컬 백업. 온라인 .backup(WAL 안전)으로 스냅샷 → gzip → N일 회전.
# 컨테이너 안에서 실행: docker compose exec -T web sh scripts/backup-db.sh
# env: DATABASE_FILE(기본 /data/prod.db), BACKUP_DIR(기본 /data/backups), BACKUP_KEEP_DAYS(기본 14)
set -eu

DB="${DATABASE_FILE:-/data/prod.db}"
DIR="${BACKUP_DIR:-/data/backups}"
KEEP="${BACKUP_KEEP_DAYS:-14}"

mkdir -p "$DIR"
TS=$(date +%Y%m%d-%H%M%S)
OUT="$DIR/prod-$TS.db"

# .backup은 온라인 백업 API라 쓰기 중에도 일관된 스냅샷(WAL 반영).
sqlite3 "$DB" ".backup '$OUT'"
gzip -f "$OUT" # → prod-$TS.db.gz

# mtime 기준 회전(KEEP일 초과 스냅샷 삭제).
find "$DIR" -name 'prod-*.db.gz' -type f -mtime +"$KEEP" -delete

echo "[backup] $DIR/prod-$TS.db.gz ($(du -h "$DIR/prod-$TS.db.gz" | cut -f1))"
