-- DfCharacter.visibility 추가. 신규 기본 'private', 기존(현재 회원전용 노출 중)은 'members'로 보존.
ALTER TABLE "DfCharacter" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private';
UPDATE "DfCharacter" SET "visibility" = 'members';
