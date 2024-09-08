import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { api } from "~/trpc/server";
import { ImageGallery } from "./image-gallery";
import { getServerAuthSession } from "~/server/auth";
import { PublishedArticleProvider } from "~/components/article/context";
import { cn } from "~/lib/utils";
import { EditorToReact } from "~/components/editor/editor-to-react";
import type { PublishedArticle } from "~/server/db/schema";
import { read_date_from_url } from "~/lib/format-date";

interface NovicaProps {
  params: {
    published_url: string;
  };
  searchParams: Record<string, string | string[] | undefined>;
}

// url_with_date: testing-04-09-2024
export default async function NovicaPage({
  params: { published_url },
  searchParams,
}: NovicaProps) {
  const session = await getServerAuthSession();

  const decoded = decodeURIComponent(published_url);
  let day: string | undefined;

  for (const key in searchParams) {
    if (key !== "dan") continue;
    const value = searchParams[key];
    if (typeof value !== "string") continue;
    day = value;
    break;
  }

  console.log("novica/", { url: decoded, day });
  const article_by_url = await api.article.get_published_by_url({
    url: decoded,
    created_at: day ? read_date_from_url(day) : undefined,
  });

  if (!article_by_url) {
    return (
      <Shell>
        <ArticleNotFound />
      </Shell>
    );
  }

  return (
    <PublishedArticleProvider article={article_by_url}>
      <Shell>
        {session ? (
          <TabbedContent article={article_by_url} />
        ) : (
          <PublishedContent article={article_by_url} />
        )}
        <ImageGallery />
      </Shell>
    </PublishedArticleProvider>
  );
}

function PublishedContent({
  article,
}: {
  article?: typeof PublishedArticle.$inferSelect;
}) {
  if (!article?.content) {
    return <ArticleNotFound />;
  }

  return (
    // <div className="container h-full min-h-screen pt-8">
    // {/* lg:prose-xl  */}
    <div className={cn(article_variants(), page_variants())}>
      <EditorToReact session={null} article={article} />
    </div>
    // </div>
  );
}

async function TabbedContent({
  article,
}: {
  article?: typeof PublishedArticle.$inferSelect;
}) {
  const session = await getServerAuthSession();

  if (!article?.content) {
    return <ArticleNotFound />;
  }

  return (
    <Tabs
      defaultValue={"published"}
      /* lg:prose-xl prose-p:text-lg prose-h1:font-normal prose-h1:text-blue-800 prose-h1:text-[40px]  */
      // prose-figcaption:text-foreground
      className={cn(article_variants(), page_variants())}
    >
      <TabsList className="not-prose">
        <TabsTrigger disabled={!article.content} value="draft">
          Osnutek
        </TabsTrigger>
        <TabsTrigger disabled={!article.content} value="published">
          Objavljeno
        </TabsTrigger>
      </TabsList>
      <TabsContent value="draft">
        <EditorToReact draft article={article} session={session} />
      </TabsContent>
      <TabsContent value="published">
        <EditorToReact article={article} session={session} />
      </TabsContent>
    </Tabs>
  );
}

function ArticleNotFound() {
  return (
    <div
      className={cn(
        page_variants(),
        "prose flex min-h-screen items-center justify-center",
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>Novica ne obstaja</CardTitle>
          <CardDescription>
            Prosim, preverite URL naslov in poskusite znova.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Če menite, da je prišlo do napake, nas kontaktirajte.</p>
          <p>Naša e-pošta: </p>
          <Link href="mailto:info@jknm.si">info@jknm.si</Link>
        </CardContent>
      </Card>
    </div>
  );
}