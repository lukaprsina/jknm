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
import { cn } from "~/lib/utils";
import { EditorToReact } from "~/components/editor/editor-to-react";
import { read_date_from_url } from "~/lib/format-date";
import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "~/components/article/card-adapter";

interface NovicaProps {
  params: {
    published_url: string;
  };
  searchParams: Record<string, string | string[] | undefined>;
}

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

  console.log("novica/ ", { url: decoded, day });
  const { draft, published } = await api.article.get_article_by_published_url({
    url: decoded,
    created_at: day ? read_date_from_url(day) : undefined,
  });

  if (!published) {
    return (
      <Shell>
        <ArticleNotFound />
      </Shell>
    );
  }

  return (
    // <PublishedArticleContext.Provider value={article_by_url}>
    <Shell>
      {session ? (
        <TabbedContent draft={draft} published={published} />
      ) : (
        <PublishedContent article={published} />
      )}
      <ImageGallery />
    </Shell>
    // </PublishedArticleContext.Provider>
  );
}

function PublishedContent({
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

async function TabbedContent({
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
