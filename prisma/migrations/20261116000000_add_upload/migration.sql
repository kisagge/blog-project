-- 업로드 파일 소유 기록(아바타 지정·교체 삭제를 본인 업로드로 제한). 기존 파일은 백필하지 않음
-- (이미 남의 파일을 아바타로 지정한 경우 소유권이 넘어가는 것을 막기 위해).
CREATE TABLE "Upload" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Upload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Upload_ownerId_kind_idx" ON "Upload"("ownerId", "kind");
