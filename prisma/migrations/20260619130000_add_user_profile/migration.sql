-- AlterTable: 프로필 자기소개·아바타(둘 다 선택).
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
