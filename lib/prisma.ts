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
// synchronous=NORMAL: WAL에서 권장값. 기본 FULL은 커밋마다 fsync — better-sqlite3는 동기라 그동안
// 메인 스레드가 멈춘다(조회 기록 등 쓰기가 잦음). NORMAL은 손상 위험 없이 정전 시 마지막 커밋 몇 개만
// 잃을 수 있다. 연결 단위 설정이지만 어댑터 연결이 하나라 1회면 충분.
void prisma.$executeRawUnsafe("PRAGMA synchronous = NORMAL").catch(() => {});
