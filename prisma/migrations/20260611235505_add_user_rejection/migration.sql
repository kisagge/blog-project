-- AlterTable
ALTER TABLE "User" ADD COLUMN "rejectedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "rejectionReason" TEXT;
