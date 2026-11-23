import FeedCardItem from "./feed-card-item";
import { toFeedCard } from "./feed-card";

type Row = Parameters<typeof toFeedCard>[0];

// 서버 렌더 글 카드 목록(인기·태그·시리즈·팔로잉 공용). 순서가 의미 있으면(시리즈 회차) ordered로 <ol>.
export default function FeedCardList({
  feeds,
  linkAuthors,
  ordered = false,
}: {
  feeds: Row[];
  linkAuthors: boolean;
  ordered?: boolean;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <List className="flex flex-col gap-6">
      {feeds.map((f) => (
        <FeedCardItem
          key={f.slug}
          card={toFeedCard(f)}
          linkAuthors={linkAuthors}
        />
      ))}
    </List>
  );
}
