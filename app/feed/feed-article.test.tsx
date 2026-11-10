import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import FeedArticle from "@/app/feed/feed-article";

// 이슈 #90: 비회원(anon) 뷰어에겐 작성자 닉네임을 프로필 링크 대신 평문으로.
describe("FeedArticle 작성자 링크 게이트(linkAuthors)", () => {
  const feed = {
    title: "제목",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    content: "본문",
  };

  test("회원 글 + linkAuthors=true → /u/{id} 프로필 링크", () => {
    render(
      <FeedArticle
        feed={feed}
        authorName="글쓴이닉"
        authorId="u1"
        linkAuthors={true}
        tags={[]}
      />,
    );
    expect(screen.getByRole("link", { name: "글쓴이닉" })).toHaveAttribute(
      "href",
      "/u/u1",
    );
  });

  test("회원 글 + linkAuthors=false(비회원 뷰어) → 링크 없이 평문", () => {
    render(
      <FeedArticle
        feed={feed}
        authorName="글쓴이닉"
        authorId="u1"
        linkAuthors={false}
        tags={[]}
      />,
    );
    expect(screen.queryByRole("link", { name: "글쓴이닉" })).toBeNull();
    expect(screen.getByText(/글쓴이닉/)).toBeInTheDocument();
  });

  test("관리자 글(authorId 없음) → linkAuthors와 무관하게 평문", () => {
    render(
      <FeedArticle
        feed={feed}
        authorName="관리자닉"
        authorId={null}
        linkAuthors={true}
        tags={[]}
      />,
    );
    expect(screen.queryByRole("link", { name: "관리자닉" })).toBeNull();
    expect(screen.getByText(/관리자닉/)).toBeInTheDocument();
  });
});

describe("FeedArticle 수정일", () => {
  const base = {
    title: "제목",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    content: "본문",
  };

  test("다른 날 수정된 글 → '수정 날짜'를 time 요소로 표시", () => {
    const { container } = render(
      <FeedArticle
        feed={{ ...base, editedAt: new Date("2026-01-05T03:00:00Z") }}
      />,
    );
    expect(screen.getByText(/수정/)).toBeInTheDocument();
    expect(
      container.querySelector('time[datetime="2026-01-05T03:00:00.000Z"]'),
    ).not.toBeNull();
  });

  test("수정 이력 없음·같은 날 수정 → 표시 안 함", () => {
    const { rerender } = render(<FeedArticle feed={base} />);
    expect(screen.queryByText(/수정/)).toBeNull();
    rerender(
      <FeedArticle
        feed={{ ...base, editedAt: new Date("2026-01-01T05:00:00Z") }}
      />,
    );
    expect(screen.queryByText(/수정/)).toBeNull();
  });
});
