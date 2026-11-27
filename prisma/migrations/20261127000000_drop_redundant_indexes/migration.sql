-- 고유 인덱스의 앞부분과 같은 열이라 중복인 일반 인덱스 제거. SQLite는 고유 인덱스의 접두 열로도
-- 같은 조회를 처리하므로 읽기는 그대로이고, 쓰기(특히 방문마다 쌓이는 View)마다 B-tree 하나·디스크가 준다.
-- View(entityType, entityId) ⊂ @@unique([entityType, entityId, visitorId, day])
DROP INDEX "View_entityType_entityId_idx";
-- FeedReaction(feedId) ⊂ @@unique([feedId, userId, emoji])
DROP INDEX "FeedReaction_feedId_idx";
-- CommentReaction(commentId) ⊂ @@unique([commentId, userId, emoji])
DROP INDEX "CommentReaction_commentId_idx";
