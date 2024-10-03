import { api } from "~/trpc/server";
import { Shell } from "~/components/shell";
import { ArticleNotFound } from "~/components/component-not-found";
import { redirect } from "next/navigation";
import { get_published_article_link } from "~/lib/article-utils";
import { named_promise_all_settled } from "~/lib/named-promise";

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await api.author.get_all.prefetch();
  // const session = await getServerAuthSession();
  let id: number | undefined;

  for (const key in searchParams) {
    if (key === "id") {
      const value = searchParams[key];
      if (typeof value === "string") {
        id = parseInt(value);
      } else if (Array.isArray(value)) {
        const first = value[0];
        if (first) {
          id = parseInt(first);
        }
      }
    }
  }

  const { article, duplicate_urls } = await named_promise_all_settled({
    article: api.article.get_article_by_published_id(id),
    duplicate_urls: api.article.get_duplicate_urls(),
  });

  if (
    article.status === "fulfilled" &&
    article.value.published &&
    duplicate_urls.status === "fulfilled"
  ) {
    redirect(
      get_published_article_link(
        article.value.published.url,
        article.value.published.created_at,
        duplicate_urls.value,
      ),
    );
  } else {
    return (
      <Shell>
        <ArticleNotFound />
      </Shell>
    );
  }
}
