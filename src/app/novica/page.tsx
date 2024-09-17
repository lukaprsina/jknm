import { api } from "~/trpc/server";
import { getServerAuthSession } from "~/server/auth";
import { Shell } from "~/components/shell";
import { ArticleNotFound } from "~/components/component-not-found";
import { PublishedContent, TabbedContent } from "~/components/content";
import { ImageGallery } from "~/app/novica/[published_url]/image-gallery";

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await api.author.get_all.prefetch();
  const session = await getServerAuthSession();
  let id: number | undefined

  for (const key in searchParams) {
    if(key === "id") {
      const value = searchParams[key];
      if (typeof value === "string") {
        id = parseInt(value);
      } else if (Array.isArray(value)) {
        const first = value[0];
        if(first) {
          id = parseInt(first);
        }
      }
    }
  }

  const {published,draft} = await api.article.get_article_by_published_id(id)

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
