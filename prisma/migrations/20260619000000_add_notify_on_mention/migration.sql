-- AlterTable: 댓글 @멘션 알림 수신 여부(기본 켜짐).
ALTER TABLE "User" ADD COLUMN "notifyOnMention" BOOLEAN NOT NULL DEFAULT true;
