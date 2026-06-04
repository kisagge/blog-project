#!/bin/sh
set -e
echo "[entrypoint] prisma migrate deploy..."
./node_modules/.bin/prisma migrate deploy
echo "[entrypoint] starting Next.js standalone server..."
exec node server.js
