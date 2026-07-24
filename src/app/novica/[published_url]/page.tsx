import type { Metadata, ResolvingMetadata } from "next";
import sanitizeHtml from "sanitize-html";
import { map_new_article_to_published_view } from "~/components/article/new-adapter";
import { ArticleNotFound } from "~/components/component-not-found";
import { PublishedContent } from "~/components/content";
import { ImageGallery } from "~/components/image-gallery";
import { Shell } from "~/components/shell";
import ScrollToTop from "~/components/shell/scroll-to-top";
import { ScrollProvider } from "~/contexts/scroll-context";
import { get_new_article_by_slug } from "~/server/article/get-article";
import { is_visible_to } from "~/server/article/lifecycle-rules";
import { getServerAuthSession } from "~/server/auth";

interface NovicaProps {
	params: Promise<{
		published_url: string;
	}>;
}

export async function generateMetadata(
	props: NovicaProps,
	parent: ResolvingMetadata,
): Promise<Metadata> {
	const params = await props.params;

	const { published_url } = params;

	const article = await get_new_article_by_slug(
		decodeURIComponent(published_url),
	);
	const awaited_parent = await parent;

	let title: string | undefined;
	if (article) {
		const session = await getServerAuthSession();
		if (is_visible_to(article.status, Boolean(session))) {
			title = article.title;
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
	const params = await props.params;

	const { published_url } = params;

	const session = await getServerAuthSession();

	const article = await get_new_article_by_slug(
		decodeURIComponent(published_url),
	);

	if (!article || !is_visible_to(article.status, Boolean(session))) {
		return (
			<Shell>
				<ArticleNotFound />
			</Shell>
		);
	}

	const new_view = map_new_article_to_published_view(
		article,
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
