import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import sanitizeHtml from "sanitize-html";
import { CreateSupersedingDraftButton } from "~/components/article/create-superseding-draft-button";
import MakeNewDraftButton from "~/components/article/make-new-draft-button";
import {
	get_primary_slug,
	map_new_article_to_editor_draft,
	map_new_article_to_published_view,
} from "~/components/article/new-adapter";
import { InfoCard } from "~/components/info-card";
import { Shell } from "~/components/shell";
import { buttonVariants } from "~/components/ui/button";
import { CardContent, CardFooter } from "~/components/ui/card";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { get_article_by_new_id } from "~/server/article/get-article";
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
	if (UUID_REGEX.test(decoded)) {
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

	if (!UUID_REGEX.test(decoded)) {
		return (
			<Shell>
				<InfoCard title="Napaka" description="Neveljaven URL novičke." />
			</Shell>
		);
	}

	const article = await get_article_by_new_id({ id: decoded });

	if (!article) {
		return (
			<Shell>
				{editor_shell(<CreateNewArticle novica_ime={draft_id} />)}
			</Shell>
		);
	}

	// `published`/`archived` rows are never edited directly (#21) — editing
	// spawns a new superseding draft instead, so the live/archived version
	// stays untouched until that draft is published.
	if (article.status === "published" || article.status === "archived") {
		return (
			<Shell>
				{editor_shell(
					<PublishedOrArchivedArticleGate
						article_id={article.id}
						title={article.title}
						status={article.status}
					/>,
				)}
			</Shell>
		);
	}

	// `deleted` is terminal — no restore action.
	if (article.status === "deleted") {
		return (
			<Shell>
				{editor_shell(<DeletedArticleGate title={article.title} />)}
			</Shell>
		);
	}

	// A superseding draft's source (the live/archived article it's revising)
	// is passed through as `published` so the editor knows archive/delete
	// there should act on the source, not this throwaway draft (#21). Once
	// the source is itself `deleted` — unarchiving deletes the archived row
	// immediately — there's no live source left to protect, so the draft is
	// treated as standalone from here on (mirrors `resolve_lifecycle_target`).
	const source = article.supersedes_id
		? await get_article_by_new_id({ id: article.supersedes_id })
		: undefined;
	const is_source_live = source !== undefined && source.status !== "deleted";

	return (
		<Shell>
			{editor_shell(
				<Editor
					key={article.id}
					draft={map_new_article_to_editor_draft(article)}
					published={
						is_source_live && source
							? map_new_article_to_published_view(
									source,
									get_primary_slug(source) ?? "",
								)
							: undefined
					}
				/>,
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

function PublishedOrArchivedArticleGate({
	article_id,
	title,
	status,
}: {
	article_id: string;
	title: string;
	status: "published" | "archived";
}) {
	const is_archived = status === "archived";

	return (
		<InfoCard
			title={
				<span>
					<strong>{title}</strong>{" "}
					{is_archived ? "je arhivirana." : "je objavljena."}
				</span>
			}
			description={
				is_archived
					? "Arhivirane novičke ni mogoče urejati neposredno."
					: "Objavljene novičke ni mogoče urejati neposredno, da ostane vidna, dokler ne objavite popravkov."
			}
		>
			<CardFooter className="flex justify-between">
				<Link className={buttonVariants({ variant: "secondary" })} href="/">
					Domov
				</Link>
				<CreateSupersedingDraftButton
					article_id={article_id}
					confirm={
						is_archived
							? {
									title: "Obnovi iz arhiva",
									description:
										"Ustvarjen bo nov osnutek na podlagi arhivirane novičke, arhivirana novička pa bo izbrisana.",
								}
							: undefined
					}
				>
					{is_archived ? "Obnovi iz arhiva" : "Uredi novičko"}
				</CreateSupersedingDraftButton>
			</CardFooter>
		</InfoCard>
	);
}

function DeletedArticleGate({ title }: { title: string }) {
	return (
		<InfoCard
			title={
				<span>
					<strong>{title}</strong> je bila izbrisana.
				</span>
			}
			description="Izbrisanih novičk ni mogoče obnoviti."
		>
			<CardFooter>
				<Link className={buttonVariants({ variant: "secondary" })} href="/">
					Domov
				</Link>
			</CardFooter>
		</InfoCard>
	);
}
