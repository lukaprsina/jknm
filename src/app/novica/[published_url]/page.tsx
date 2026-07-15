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

	const { published } = await get_articles(published_url, searchParams);
	const awaited_parent = await parent;

	let title = published?.title;

	if (!title) {
		const session = await getServerAuthSession();
		const new_article = await get_new_article_by_slug(
			decodeURIComponent(published_url),
		);
		if (new_article && is_visible_to(new_article.status, Boolean(session))) {
			title = new_article.title;
		}
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

	const { draft, published } = await get_articles(published_url, searchParams);

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

	// Fall back to a new-table article addressed by its slug (#20).
	const decoded = decodeURIComponent(published_url);
	const new_article = await get_new_article_by_slug(decoded);

	// `archived`/`deleted` articles 404 on their public route for non-admins
	// (#21); `deleted` is terminal and 404s for everyone.
	if (!new_article || !is_visible_to(new_article.status, Boolean(session))) {
		return (
			<Shell>
				<ArticleNotFound />
			</Shell>
		);
	}

	const new_view = map_new_article_to_published_view(new_article, decoded);

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
