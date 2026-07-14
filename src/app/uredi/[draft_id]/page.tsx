import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import sanitizeHtml from "sanitize-html";
import MakeNewDraftButton from "~/components/article/make-new-draft-button";
import { map_new_article_to_editor_draft } from "~/components/article/new-adapter";
import { InfoCard } from "~/components/info-card";
import { Shell } from "~/components/shell";
import { buttonVariants } from "~/components/ui/button";
import { CardContent, CardFooter } from "~/components/ui/card";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import {
	get_article_by_draft_id,
	get_article_by_new_id,
} from "~/server/article/get-article";
import { getServerAuthSession } from "~/server/auth";
import Editor from "./editor";

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* const Editor = dynamic(() => import("./editor"), {
  ssr: false,
}); */

interface EditorPageProps {
	params: Promise<{
		draft_id: string;
	}>;
}

export async function generateMetadata(
	props: EditorPageProps,
	_parent: ResolvingMetadata,
): Promise<Metadata> {
	const params = await props.params;

	const { draft_id } = params;

	const session = await getServerAuthSession();
	if (!session)
		return {
			title: "Napaka",
		};

	const decoded = decodeURIComponent(draft_id);

	let article_title: string | undefined;
	if (/^\d+$/.test(decoded)) {
		const { draft } = await get_article_by_draft_id({
			draft_id: parseInt(decoded, 10),
		});
		article_title = draft?.title;
	} else if (UUID_REGEX.test(decoded)) {
		const article = await get_article_by_new_id({ id: decoded });
		article_title = article?.title;
	}

	const title = article_title
		? sanitizeHtml(article_title, {
				allowedTags: [],
			})
		: "Uredi novico";

	return {
		title,
	};
}

export default async function EditorPage(props: EditorPageProps) {
	const params = await props.params;

	const { draft_id } = params;

	const session = await getServerAuthSession();
	if (!session) return notFound();

	const decoded = decodeURIComponent(draft_id);

	const editor_shell = (children: ReactNode) => (
		<div
			className={cn(
				article_variants(),
				page_variants({ max_width: "wide" }),
				"min-h-screen",
			)}
		>
			{children}
		</div>
	);

	// New (uuid) articles on the unified `articles` table.
	if (UUID_REGEX.test(decoded)) {
		const article = await get_article_by_new_id({ id: decoded });

		return (
			<Shell>
				{editor_shell(
					article ? (
						<Editor draft={map_new_article_to_editor_draft(article)} />
					) : (
						<CreateNewArticle novica_ime={draft_id} />
					),
				)}
			</Shell>
		);
	}

	// Legacy numeric draft/published articles.
	if (!/^\d+$/.test(decoded)) {
		return (
			<Shell>
				<InfoCard title="Napaka" description="Neveljaven URL novičke." />
			</Shell>
		);
	}

	const { draft, published } = await get_article_by_draft_id({
		draft_id: parseInt(decoded, 10),
	});

	return (
		<Shell draft_article={draft} published_article={published}>
			{editor_shell(
				draft ? (
					<Editor draft={draft} published={published} />
				) : (
					<CreateNewArticle novica_ime={draft_id} />
				),
			)}
		</Shell>
	);
}

function CreateNewArticle({ novica_ime }: { novica_ime: string }) {
	return (
		<InfoCard
			title={
				<span>
					Osnutek z ID <strong>{novica_ime}</strong> ne obstaja.
				</span>
			}
			description="Preverite, če je ID pravilen."
		>
			<CardContent>
				Lahko pa ustvarite novo novičko z ID <strong>{novica_ime}</strong>.
			</CardContent>
			<CardFooter className="flex justify-between">
				<Link className={buttonVariants({ variant: "secondary" })} href="/">
					Domov
				</Link>
				<MakeNewDraftButton title={novica_ime}>
					Ustvari novico
				</MakeNewDraftButton>
			</CardFooter>
		</InfoCard>
	);
}
