import { ArticleNotFound } from "~/components/component-not-found";
import { Shell } from "~/components/shell";

/**
 * Route-level 404 for `/novica/<slug>`, rendered by `notFound()` in `page.tsx`.
 *
 * This exists so a missing or hidden article answers with a real **HTTP 404**
 * while keeping the article-specific Slovenian copy. It previously returned
 * `<ArticleNotFound/>` from the page itself, which meant HTTP 200 — a soft 404.
 * Google is explicit that a success status tells it "there's a real page at
 * this URL", so it keeps the phantom URL indexed and keeps spending crawl
 * budget on it instead of on real articles.
 */
export default function ArticleNotFoundPage() {
	return (
		<Shell>
			<ArticleNotFound />
		</Shell>
	);
}
