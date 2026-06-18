import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 dropped the built-in query engine — a driver adapter is now required.
// Local SQLite (DATABASE_URL="file:./dev.db") is served by better-sqlite3.
// timeout = busy_timeout(ms). better-sqlite3 기본도 5000이지만 의도를 명시한다.
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL!,
  timeout: 5000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// WAL 모드: 쓰기(조회수 트래킹·댓글·좋아요)가 읽기를 막지 않아 동시 처리량↑.
// 파일 레벨 영구 설정이라 1회 적용으로 충분(이후 -wal/-shm로 유지). 연결 전/빌드 실패는 무시.
void prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL").catch(() => {});
