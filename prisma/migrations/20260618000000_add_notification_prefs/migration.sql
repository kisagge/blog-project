-- AlterTable: 회원별 알림 종류 on/off(이벤트 단위 — off면 인앱·푸시 모두 미생성). 기본값 켜짐.
ALTER TABLE "User" ADD COLUMN "notifyOnReply" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyOnComment" BOOLEAN NOT NULL DEFAULT true;
