import { Shell } from "~/components/shell";
import { api } from "~/trpc/server";
import { ImageGallery } from "./image-gallery";
import { getServerAuthSession } from "~/server/auth";
import { read_date_from_url } from "~/lib/format-date";
import { ArticleNotFound } from "~/components/component-not-found";
import { PublishedContent, TabbedContent } from "~/components/content";
import type { Metadata, ResolvingMetadata } from "next";
import DOMPurify from "isomorphic-dompurify";

interface NovicaProps {
  params: {
    published_url: string;
  };
  searchParams: Record<string, string | string[] | undefined>;
}

export async function generateMetadata(
  { params: { published_url }, searchParams }: NovicaProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { published } = await get_articles(published_url, searchParams);
  const awaited_parent = await parent;

  let title = published?.title;

  if (!title) {
    title = awaited_parent.title?.absolute;
  }

  if (!title) {
    title = "Jamarski klub Novo mesto";
  }

  return {
    title: DOMPurify.sanitize(title, {
      ALLOWED_TAGS: [],
    }),
  };
}

export default async function NovicaPage({
  params: { published_url },
  searchParams,
}: NovicaProps) {
  const session = await getServerAuthSession();

  const { draft, published } = await get_articles(published_url, searchParams);

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

async function get_articles(
  published_url: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  await api.author.get_all.prefetch();

  const decoded = decodeURIComponent(published_url);
  let day: string | undefined;

  for (const key in searchParams) {
    if (key !== "dan") continue;
    const value = searchParams[key];
    if (typeof value !== "string") continue;
    day = value;
    break;
  }

  return await api.article.get_article_by_published_url({
    url: decoded,
    created_at: day ? read_date_from_url(day) : undefined,
  });
}
