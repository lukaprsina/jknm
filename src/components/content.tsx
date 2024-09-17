import type { DraftArticleWithAuthors, PublishedArticleWithAuthors } from "~/components/article/card-adapter";
import { ArticleNotFound } from "~/components/component-not-found";
import { cn } from "~/lib/utils";
import { article_variants, page_variants } from "~/lib/page-variants";
import { EditorToReact } from "~/components/editor/editor-to-react";
import { getServerAuthSession } from "~/server/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";


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
  const session = await getServerAuthSession();

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
        <EditorToReact article={draft} session={session} />
      </TabsContent>
      <TabsContent value="published">
        <EditorToReact article={published} session={session} />
      </TabsContent>
    </Tabs>
  );
}