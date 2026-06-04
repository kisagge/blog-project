#!/bin/sh
set -e
echo "[entrypoint] prisma migrate deploy..."
./node_modules/.bin/prisma migrate deploy
echo "[entrypoint] starting Next.js (next start)..."
exec ./node_modules/.bin/next start -p 3010 -H 0.0.0.0
