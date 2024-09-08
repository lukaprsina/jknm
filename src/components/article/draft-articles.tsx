import type { DraftArticle } from "~/server/db/schema";

export function DraftArticles({
  articles,
}: {
  articles: (typeof DraftArticle.$inferSelect)[];
}) {
  return (
    <div>
      {articles.map((article) => (
        <div key={article.id}>
          <h3>{article.title}</h3>
          <p>{article.id}</p>
        </div>
      ))}
    </div>
  );
}
