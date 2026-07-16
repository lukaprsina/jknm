import type { Metadata, ResolvingMetadata } from "next";
import sanitizeHtml from "sanitize-html";
import { map_new_article_to_published_view } from "~/components/article/new-adapter";
import { ArticleNotFound } from "~/components/component-not-found";
import { PublishedContent, TabbedContent } from "~/components/content";
import { Shell } from "~/components/shell";
import ScrollToTop from "~/components/shell/scroll-to-top";
import { ScrollProvider } from "~/contexts/scroll-context";
import { read_date_from_url } from "~/lib/format-date";
import {
	get_article_by_published_url,
	get_new_article_by_slug,
} from "~/server/article/get-article";
import { is_visible_to } from "~/server/article/lifecycle-rules";
import { getServerAuthSession } from "~/server/auth";
import { ImageGallery } from "./image-gallery";

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

	const resolved = await resolve_article(published_url, searchParams);
	const awaited_parent = await parent;

	let title: string | undefined;
	if (resolved.kind === "new") {
		const session = await getServerAuthSession();
		if (is_visible_to(resolved.article.status, Boolean(session))) {
			title = resolved.article.title;
		}
	} else {
		title = resolved.published?.title;
	}

	title ??= awaited_parent.title?.absolute;
	title ??= "Jamarski klub Novo mesto";

	return {
		title: sanitizeHtml(title, {
			allowedTags: [],
		}),
	};
}

export default async function NovicaPage(props: NovicaProps) {
	const searchParams = await props.searchParams;
	const params = await props.params;

	const { published_url } = params;

	const session = await getServerAuthSession();

	const resolved = await resolve_article(published_url, searchParams);

	if (resolved.kind === "new") {
		const { article: new_article } = resolved;

		// `archived`/`deleted` articles 404 on their public route for
		// non-admins (#21); `deleted` is terminal and 404s for everyone.
		if (!is_visible_to(new_article.status, Boolean(session))) {
			return (
				<Shell>
					<ArticleNotFound />
				</Shell>
			);
		}

		const new_view = map_new_article_to_published_view(
			new_article,
			decodeURIComponent(published_url),
		);

		return (
			<Shell published_article={new_view}>
				<ScrollProvider>
					<PublishedContent article={new_view} />
					<ImageGallery />
					<ScrollToTop />
				</ScrollProvider>
			</Shell>
		);
	}

	const { draft, published } = resolved;

	if (published) {
		return (
			<Shell draft_article={draft} published_article={published}>
				<ScrollProvider>
					{session ? (
						<TabbedContent draft={draft} published={published} />
					) : (
						<PublishedContent article={published} />
					)}
					<ImageGallery />
					<ScrollToTop />
				</ScrollProvider>
			</Shell>
		);
	}

	return (
		<Shell>
			<ArticleNotFound />
		</Shell>
	);
}

/**
 * Once an article is migrated (#22) it becomes canonical at its slug (#23):
 * check the new `articles` table first, and only fall back to the legacy
 * `published_article` lookup (with its `?dan` day-disambiguation) when no
 * migrated counterpart exists yet. None of the ~700 legacy slugs actually
 * collide, so `?dan` never needs to apply to a migrated article.
 */
async function resolve_article(
	published_url: string,
	searchParams: Record<string, string | string[] | undefined>,
) {
	const decoded = decodeURIComponent(published_url);

	const new_article = await get_new_article_by_slug(decoded);
	if (new_article) {
		return { kind: "new" as const, article: new_article };
	}

	let day: string | undefined;
	for (const key in searchParams) {
		if (key !== "dan") continue;
		const value = searchParams[key];
		if (typeof value !== "string") continue;
		day = value;
		break;
	}

	const { published, draft } = await get_article_by_published_url({
		url: decoded,
		created_at: day ? read_date_from_url(day) : undefined,
	});

	return { kind: "legacy" as const, published, draft };
}
