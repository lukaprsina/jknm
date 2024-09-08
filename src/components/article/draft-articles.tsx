import type { DraftArticleWithAuthors } from "./card-adapter";
import { DraftArticleDrizzleCard } from "./card-adapter";

export function DraftArticles({
  articles,
}: {
  articles: DraftArticleWithAuthors[];
}) {
  return (
    <div>
      {articles.map((article) => (
        <DraftArticleDrizzleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
