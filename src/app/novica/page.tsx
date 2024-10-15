import { Shell } from "~/components/shell";
import { ArticleNotFound } from "~/components/component-not-found";
import { redirect } from "next/navigation";
import { get_published_article_link } from "~/lib/article-utils";
import { get_article_by_published_id } from "~/server/article/get-article";
import { cachedDuplicateUrls } from "~/server/cached-global-state";

export default async function Page(
  props: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
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
  const not_found = (
    <Shell>
      <ArticleNotFound />
    </Shell>
  );

  if (typeof id !== "number") return not_found;

  const [article, duplicate_urls] = await Promise.all([
    get_article_by_published_id({ published_id: id }),
    cachedDuplicateUrls(),
  ]);

  if (article.published) {
    const new_url = get_published_article_link(
      article.published.url,
      article.published.created_at,
      duplicate_urls,
    );

    redirect(new_url);
  } else {
    return not_found;
  }
}
