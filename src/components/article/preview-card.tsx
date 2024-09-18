import { Card, CardContent } from "~/components/ui/card";
import { format_date_for_human } from "~/lib/format-date";
import { article_variants } from "~/lib/page-variants";
import {
  DraftArticleDrizzleCard,
  DraftArticleWithAuthors,
  PublishedArticleDrizzleCard,
  PublishedArticleWithAuthors,
} from "~/components/article/card-adapter";

export function PublishedArticlePreviewCard({
  article,
}: {
  article?: PublishedArticleWithAuthors;
}) {
  if (!article) {
    return;
  }

  return (
    <Card>
      <CardContent className="pb-0 pr-0">
        <div className={"grid grid-cols-2"}>
          <div>
            <h3 className="!my-4">Uredi osnutek</h3>
            <p>Naslov: {article.title}</p>
            <p>Ustvarjen: {format_date_for_human(article.created_at)}</p>
            <p>Posodobljen: {format_date_for_human(article.updated_at)}</p>
          </div>
          <div className={article_variants({ variant: "card" })}>
            <PublishedArticleDrizzleCard article={article} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DraftArticlePreviewCard({
  article,
}: {
  article?: DraftArticleWithAuthors;
}) {
  if (!article) {
    return;
  }

  return (
    <Card>
      <CardContent className="pb-0 pr-0">
        <div className={"grid grid-cols-2"}>
          <div>
            <h3 className="!my-4">Uredi osnutek</h3>
            <p>Naslov: {article.title}</p>
            <p>Ustvarjen: {format_date_for_human(article.created_at)}</p>
            <p>Posodobljen: {format_date_for_human(article.updated_at)}</p>
          </div>
          <div className={article_variants({ variant: "card" })}>
            <DraftArticleDrizzleCard article={article} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
