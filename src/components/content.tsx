import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "~/components/article/adapter";
import { ArticleNotFound } from "~/components/component-not-found";
import { cn } from "~/lib/utils";
import { article_variants, page_variants } from "~/lib/page-variants";
import { EditorToReact } from "~/components/editor/editor-to-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import ArticleDescription from "./article/description";

export function PublishedContent({
  article,
}: {
  article?: PublishedArticleWithAuthors;
}) {
  if (!article?.content) {
    return <ArticleNotFound />;
  }

  const author_ids = article.published_articles_to_authors.map(
    (a) => a.author_id,
  );

  return (
    <div className={cn(article_variants(), page_variants())}>
      <EditorToReact
        article={article}
        description={
          <ArticleDescription
            type="page"
            author_ids={author_ids}
            created_at={article.created_at}
            old_id={article.old_id?.toString()}
          />
        }
      />
    </div>
  );
}

export function TabbedContent({
  draft,
  published,
}: {
  draft?: DraftArticleWithAuthors;
  published?: PublishedArticleWithAuthors;
}) {
  if (!draft?.content && !published?.content) {
    return <ArticleNotFound />;
  }

  const draft_description = draft ? (
    <ArticleDescription
      type="page"
      author_ids={draft.draft_articles_to_authors.map((a) => a.author_id)}
      created_at={draft.created_at}
    />
  ) : undefined;

  const published_description = published ? (
    <ArticleDescription
      type="page"
      author_ids={published.published_articles_to_authors.map(
        (a) => a.author_id,
      )}
      created_at={published.created_at}
      old_id={published.old_id?.toString()}
    />
  ) : undefined;

  return (
    <Tabs
      defaultValue={"published"}
      className={cn(article_variants(), page_variants())}
    >
      <TabsList className="not-prose">
        <TabsTrigger disabled={!draft?.content} value="draft">
          Osnutek
        </TabsTrigger>
        <TabsTrigger disabled={!published?.content} value="published">
          Objavljeno
        </TabsTrigger>
      </TabsList>
      <TabsContent value="draft">
        <div className={cn("flex flex-col gap-6")}>
          <EditorToReact article={draft} description={draft_description} />
        </div>
      </TabsContent>
      <TabsContent value="published">
        <div className={cn("flex flex-col gap-6")}>
          <EditorToReact
            article={published}
            description={published_description}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
