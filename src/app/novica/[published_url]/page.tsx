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
import { ArticleNotFound } from "~/components/component-not-found";
import { PublishedContent, TabbedContent } from "~/components/content";

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
  await api.author.get_all.prefetch();
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

  const { draft, published } = await api.article.get_article_by_published_url({
    url: decoded,
    created_at: day ? read_date_from_url(day) : undefined,
  });
  // console.log("novica/ ", { url: decoded, day, draft, published });

  if (!published) {
    return (
      <Shell>
        <ArticleNotFound />
      </Shell>
    );
  }

  return (
    <Shell draft_article={draft} published_article={published}>
      {session ? (
        <TabbedContent draft={draft} published={published} />
      ) : (
        <PublishedContent article={published} />
      )}
      <ImageGallery />
    </Shell>
  );
}
