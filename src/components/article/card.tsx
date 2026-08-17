"use client";

import { AspectRatio } from "@radix-ui/react-aspect-ratio";
import type { Hit as SearchHit } from "instantsearch.js";
import { LinkIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { IntersectionRef } from "~/app/infinite-articles";
import { CardContent, CardHeader } from "~/components/ui/card";
import { env } from "~/env";
import { useToast } from "~/hooks/use-toast";
import {
	get_published_article_link,
	get_s3_published_directory,
} from "~/lib/article-utils";
import { get_base_url } from "~/lib/get-base-url";
import { get_s3_prefix } from "~/lib/s3-publish";
import { sanitize_inline_html } from "~/lib/sanitize-html";
import { cn } from "~/lib/utils";
import type { PublishedArticleHit } from "~/lib/validators";
import { MagicCard } from "../magic-card";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import ArticleDescription from "./description";
/* const ArticleDescription = dynamic(() => import("./description"), {
  ssr: false,
  loading: () => <Skeleton className="h-[1em] w-[300px] bg-[hsl(0_0%_90%)]" />,
}); */

export function ArticleCard({
	featured,
	title,
	url,
	permalink_url,
	content_preview,
	date,
	has_thumbnail,
	image_url,
	author_ids,
	ref,
}: {
	featured?: boolean;
	title: string;
	url: string;
	permalink_url?: string;
	content_preview?: string;
	/** The article's published date, or its creation date while still unpublished (see callers). */
	date: Date;
	has_thumbnail: boolean;
	image_url?: string;
	author_ids: number[];
	ref?: IntersectionRef;
}) {
	const [hover, setHover] = useState(false);
	const [hoverLink, setHoverLink] = useState(false);
	const toaster = useToast();

	return (
		<Link
			href={url}
			className={cn(
				"overflow-hidden rounded-xl bg-transparent no-underline shadow-lg",
				featured && "col-span-1 md:col-span-2 lg:col-span-3",
			)}
			prefetch={false}
			ref={ref}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
		>
			<MagicCard
				className="flex h-full flex-col"
				innerClassName="h-full"
				gradientColor="#D9D9D955"
			>
				{has_thumbnail && image_url ? (
					<AspectRatio
						ratio={16 / 9}
						className={cn(
							"relative rounded-md transition-transform",
							hover ? "scale-[1.01]" : null,
						)}
					>
						<Image
							// https://jknm.s3.eu-central-1.amazonaws.com/potop-v-termalni-izvir-29-02-2008/1_gradbena%20jama.jpg
							// https://jknm.s3.eu-central-1.amazonaws.com/potop-v-termalni-izvir-29-02-2008/thumbnail.jpg
							// https://jknm-draft.s3.eu-central-1.amazonaws.com//uredi/41/thumbnail.png
							src={image_url}
							alt={title}
							fill
							// loader={({ src }) => src}
							priority={featured}
							className="rounded-md object-cover"
						/>
					</AspectRatio>
				) : null}
				{/* TODO: prose-h3:text-xl prose-h3:font-semibold*/}
				<div className="h-full">
					<CardHeader>
						{/* biome-ignore lint/a11y/noStaticElementInteractions: purely a hover reveal for the tooltip button below, which is independently focusable/keyboard-accessible */}
						<div
							className="flex justify-between gap-2"
							onMouseEnter={() => setHoverLink(true)}
							onMouseLeave={() => setHoverLink(false)}
						>
							<h3
								className="line-clamp-2 h-[3em]"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via sanitize_inline_html (DOMPurify) — title may carry EditorJS inline formatting
								dangerouslySetInnerHTML={{
									__html: sanitize_inline_html(title),
								}}
							/>
							{permalink_url && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											className={cn(
												"shrink-0 opacity-100 transition-opacity",
												!hoverLink && "opacity-0",
											)}
											size="icon"
											variant="ghost"
											onClick={async (e) => {
												e.preventDefault();
												e.stopPropagation();

												toaster.toast({
													title: "Trajna povezava je kopirana v odložišče.",
													description: permalink_url,
												});

												await navigator.clipboard.writeText(permalink_url);
											}}
										>
											<LinkIcon size={18} />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Kopiraj trajno povezavo</TooltipContent>
								</Tooltip>
							)}
						</div>
						<div className="flex w-full justify-between gap-2">
							<ArticleDescription
								type={featured ? "card-featured" : "card"}
								author_ids={author_ids}
								date={date}
							/>
						</div>
					</CardHeader>
					<CardContent className="">
						<div className="h-full">
							<p
								className={cn(
									"relative line-clamp-3 items-end",
									!has_thumbnail && "line-clamp-4",
								)}
							>
								{content_preview}
							</p>
						</div>
					</CardContent>
				</div>
			</MagicCard>
		</Link>
	);
}

export function ArticleAlgoliaCard({
	hit,
	ref,
}: {
	hit: SearchHit<PublishedArticleHit>;
	ref?: IntersectionRef;
}) {
	// Legacy hits (numeric objectID) have no `image` and are resolved via the
	// old S3 thumbnail.png path convention; new-model hits (uuid objectID)
	// carry an absolute gradivo.jknm.org `image` URL directly.
	const is_legacy_hit = /^\d+$/.test(hit.objectID);
	const url = get_published_article_link(hit.url);
	// Every article's stable permalink is its slug URL, backed by
	// `article_slugs` redirects that follow renames and supersede-publish.
	const permalink_url = `${get_base_url(true)}${url}`;

	return (
		<ArticleCard
			ref={ref}
			featured={false}
			title={hit.title}
			url={url}
			permalink_url={permalink_url}
			content_preview={hit.content_preview?.slice(0, 1000)}
			date={new Date(hit.published_at)}
			has_thumbnail={hit.has_thumbnail}
			author_ids={hit.author_ids}
			image_url={
				is_legacy_hit
					? get_s3_prefix(
							`${get_s3_published_directory(hit.url, hit.created_at)}/thumbnail.png`,
							env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
						)
					: hit.image
			}
		/>
	);
}
