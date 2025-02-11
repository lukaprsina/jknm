import { Shell } from "~/components/shell";
import { ImageGallery } from "./image-gallery";
import { getServerAuthSession } from "~/server/auth";
import { read_date_from_url } from "~/lib/format-date";
import { ArticleNotFound } from "~/components/component-not-found";
import { PublishedContent, TabbedContent } from "~/components/content";
import type { Metadata, ResolvingMetadata } from "next";
import DOMPurify from "isomorphic-dompurify";
import { get_article_by_published_url } from "~/server/article/get-article";
import { ScrollProvider } from "~/contexts/ScrollContext";
import ScrollToTop from "~/components/shell/scroll-to-top";

interface NovicaProps {
  params: Promise<{
    published_url: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(
  props: NovicaProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const { published_url } = params;

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

export default async function NovicaPage(props: NovicaProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const { published_url } = params;

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
      <ScrollProvider>
        <ScrollToTop />
        {session ? (
          <TabbedContent draft={draft} published={published} />
        ) : (
          <PublishedContent article={published} />
        )}
        <ImageGallery />
      </ScrollProvider>
    </Shell>
  );
}

async function get_articles(
  published_url: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const decoded = decodeURIComponent(published_url);
  let day: string | undefined;

  for (const key in searchParams) {
    if (key !== "dan") continue;
    const value = searchParams[key];
    if (typeof value !== "string") continue;
    day = value;
    break;
  }

  return get_article_by_published_url({
    url: decoded,
    created_at: day ? read_date_from_url(day) : undefined,
  });
}
