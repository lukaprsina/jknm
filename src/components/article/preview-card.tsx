import { Card, CardContent } from "~/components/ui/card";
import { format_date_for_human } from "~/lib/format-date";
import { article_variants } from "~/lib/page-variants";
import {
  DraftArticleDrizzleCard,
  DraftArticleWithAuthors,
  PublishedArticleDrizzleCard,
  PublishedArticleWithAuthors,
} from "~/components/article/card-adapter";
import { get_published_article_link } from "~/lib/article-utils";
import { api } from "~/trpc/react";
import { useDuplicatedUrls } from "~/hooks/use-duplicated-urls";
import Link from "next/link";

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
            <h3 className="!my-4">Objavljena novica</h3>
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
  draft_article,
  published_article,
  duplicated_urls,
}: {
  draft_article?: DraftArticleWithAuthors;
  published_article?: PublishedArticleWithAuthors;
  duplicated_urls: string[];
}) {
  if (!draft_article) {
    return;
  }

  return (
    <Card>
      <CardContent className="pb-0 pr-0">
        <div className={"grid grid-cols-2"}>
          <div>
            <h3 className="!my-4">Uredi osnutek</h3>
            <p>Naslov: {draft_article.title}</p>
            <p>Ustvarjen: {format_date_for_human(draft_article.created_at)}</p>
            <p>
              Posodobljen: {format_date_for_human(draft_article.updated_at)}
            </p>
            {published_article && (
              <p>
                Objavljena verzija:{" "}
                <Link
                  target="_blank"
                  href={get_published_article_link(
                    published_article.url,
                    published_article.created_at,
                    duplicated_urls,
                  )}
                >
                  {published_article.title}
                </Link>
              </p>
            )}
          </div>
          <div className={article_variants({ variant: "card" })}>
            <DraftArticleDrizzleCard no_link article={draft_article} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
