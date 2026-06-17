-- 피드 전문 검색(FTS5): external content(텍스트 중복 저장 회피) + trigram(한국어/CJK 부분일치).
-- "Feed"의 암묵 rowid를 content_rowid로 공유. 가중치(title>summary>content)는 쿼리 시 bm25()로 지정.
-- 가상테이블·트리거는 Prisma 모델로 표현 불가 → schema.prisma 밖 raw SQL.
-- 주의: lib/test-db.ts의 SCHEMA 배열에도 동일 DDL을 동기화해야 테스트에서 검색이 동작한다.
CREATE VIRTUAL TABLE "feed_fts" USING fts5(
  title,
  summary,
  content,
  content='Feed',
  content_rowid='rowid',
  tokenize='trigram'
);

-- "Feed" 변경을 feed_fts에 동기화. external content는 DELETE/UPDATE 시 'delete' 특수명령으로 옛 행 제거 필수.
CREATE TRIGGER "feed_fts_ai" AFTER INSERT ON "Feed" BEGIN
  INSERT INTO "feed_fts"(rowid, title, summary, content)
  VALUES (new.rowid, new.title, new.summary, new.content);
END;

CREATE TRIGGER "feed_fts_ad" AFTER DELETE ON "Feed" BEGIN
  INSERT INTO "feed_fts"(feed_fts, rowid, title, summary, content)
  VALUES ('delete', old.rowid, old.title, old.summary, old.content);
END;

-- UPDATE OF: 텍스트 컬럼이 바뀔 때만 재색인(viewCount 증가 등 비텍스트 UPDATE는 건너뜀 → 조회마다 재색인 방지).
CREATE TRIGGER "feed_fts_au" AFTER UPDATE OF title, summary, content ON "Feed" BEGIN
  INSERT INTO "feed_fts"(feed_fts, rowid, title, summary, content)
  VALUES ('delete', old.rowid, old.title, old.summary, old.content);
  INSERT INTO "feed_fts"(rowid, title, summary, content)
  VALUES (new.rowid, new.title, new.summary, new.content);
END;

-- 기존 데이터 백필(마이그레이션 시점 전체 Feed 색인).
INSERT INTO "feed_fts"(rowid, title, summary, content)
SELECT rowid, title, summary, content FROM "Feed";
