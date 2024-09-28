import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "~/components/article/adapter";
import { ArticleNotFound } from "~/components/component-not-found";
import { cn } from "~/lib/utils";
import { article_variants, page_variants } from "~/lib/page-variants";
import { EditorToReact } from "~/components/editor/editor-to-react";
import { getServerAuthSession } from "~/server/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/server";
import { named_promise_all_settled } from "~/lib/named-promise";

export function PublishedContent({
  article,
}: {
  article?: PublishedArticleWithAuthors;
}) {
  if (!article?.content) {
    return <ArticleNotFound />;
  }

  return (
    <div className={cn(article_variants(), page_variants())}>
      <EditorToReact article={article} session={null} />
    </div>
  );
}

export async function TabbedContent({
  draft,
  published,
}: {
  draft?: DraftArticleWithAuthors;
  published?: PublishedArticleWithAuthors;
}) {
  const { session, duplicated_urls } = await named_promise_all_settled({
    session: getServerAuthSession(),
    duplicated_urls: api.article.get_duplicate_urls(),
  });

  if (session.status === "rejected" || duplicated_urls.status === "rejected") {
    return;
  }

  if (!draft?.content && !published?.content) {
    return <ArticleNotFound />;
  }

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
          <EditorToReact article={draft} session={session.value} />
        </div>
      </TabsContent>
      <TabsContent value="published">
        <div className={cn("flex flex-col gap-6")}>
          <EditorToReact article={published} session={session.value} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
