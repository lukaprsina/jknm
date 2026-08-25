"use client";

import "./editorjs-attaches.css";

import type { RenderFn } from "editorjs-blocks-react-renderer";
import Blocks from "editorjs-blocks-react-renderer";
import HTMLReactParser from "html-react-parser";
import Image from "next/image";
import Link from "next/link";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import ArticleDescription from "~/components/article/description";
import { gallery_store, useGalleryImages } from "~/components/gallery-store";
import { TableOfContents } from "~/components/toc/table-of-contents";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import type { EditorJSImageData } from "~/lib/editor-utils";
import {
	extract_headings_from_content,
	extract_media_refs_from_content,
	get_heading_from_editor,
} from "~/lib/editor-utils";
import { human_file_size } from "~/lib/human-file-size";
import { sanitize_inline_html } from "~/lib/sanitize-html";
import { TOC_HEADING_LEVELS } from "~/lib/toc";
import { cn } from "~/lib/utils";
import type {
	EditorDraftArticle,
	PublishedArticleView,
} from "../article/new-adapter";

// Editor content is rendered from stored HTML (paragraph/list/quote/etc.
// all pass through html-react-parser), so patching every renderer isn't
// practical — force target="_blank" on the mounted DOM instead.
function ArticleLinksInNewTab({ children }: { children: React.ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const links = ref.current?.querySelectorAll("a[href]") ?? [];
		for (const link of links) {
			link.setAttribute("target", "_blank");
			link.setAttribute("rel", "noopener noreferrer");
		}
	});

	return <div ref={ref}>{children}</div>;
}

function ArticleBody({
	blocks_data,
}: {
	blocks_data: NonNullable<ReturnType<typeof useEditorData>["blocks_data"]>;
}) {
	return (
		<ArticleLinksInNewTab>
			<Blocks
				data={blocks_data}
				renderers={{
					image: NextImageRenderer,
					attaches: AttachesRenderer,
					header: HeaderRenderer,
					table: TableRenderer,
				}}
			/>
		</ArticleLinksInNewTab>
	);
}

function useEditorData(
	article: { content: EditorDraftArticle["content"] } | undefined,
) {
	const content = article?.content;

	// Fallback for content saved without a `time` field — captured once per
	// mount rather than via a fresh `Date.now()` on every recompute.
	const [defaultTime] = useState(() => Date.now());

	const headings = useMemo(() => {
		if (!content) return [];
		// The article H1 (block 0) is rendered separately below, not through
		// `ArticleBody`, but it still needs a TOC entry -- so `levels` is widened
		// to include it here rather than in the shared `TOC_HEADING_LEVELS`
		// default (which `static-nav-sections.ts` also relies on). One call
		// keeps a single dedup pass, so an H1 that happens to share wording
		// with a later H2/H3 still gets a distinct slug instead of colliding.
		return extract_headings_from_content(content, [1, ...TOC_HEADING_LEVELS]);
	}, [content]);

	const h1_id = headings[0]?.id;

	const blocks_data = useMemo(() => {
		if (!content) return;

		const heading_by_block_index = new Map(
			headings.map((heading) => [heading.block_index, heading.id]),
		);

		const blocks = content.blocks
			.slice(1) // remove first heading (the article H1, rendered separately below)
			.map((block, index) => {
				const toc_id = heading_by_block_index.get(index + 1);
				if (!toc_id) return block;
				return { ...block, data: { ...block.data, toc_id } };
			});

		return {
			version: content.version ?? "unknown version",
			blocks,
			time: content.time ?? defaultTime,
		};
	}, [content, headings, defaultTime]);

	return { blocks_data, headings, h1_id };
}

export function EditorToReact({
	article,
}: {
	article: EditorDraftArticle | PublishedArticleView | undefined;
}) {
	const { blocks_data, headings, h1_id } = useEditorData(article);
	const content = article?.content;

	// Derived synchronously from `article.content` (available at first paint,
	// SSR included) rather than via useEffect+useState, which left every
	// article flashing "Untitled" until the effect ran post-hydration.
	const heading = useMemo(() => {
		if (!content) return undefined;

		const heading_info = get_heading_from_editor(content);

		let title = heading_info.title;
		if (heading_info.error || !title) {
			console.error("Invalid heading", heading_info);
			title = "Invalid heading";
		}

		return sanitize_inline_html(title);
	}, [content]);

	const gallery_images = useMemo(() => {
		if (!content) return [];

		return extract_media_refs_from_content(content, ["image"])
			.map((ref) => ref.data)
			.map((data) => {
				const { width, height } = get_effective_dimensions(data.file);
				return { ...data, file: { ...data.file, width, height } };
			});
	}, [content]);

	useEffect(() => {
		gallery_store.getState().registerImages(gallery_images);
	}, [gallery_images]);

	const author_ids = useMemo(() => {
		if (!article) return [];

		return "published_articles_to_authors" in article
			? article.published_articles_to_authors.map((a) => a.author_id)
			: article.draft_articles_to_authors.map((a) => a.author_id);
	}, [article]);

	if (!blocks_data || !article) return;

	// Content-kind pages (the 5 fixed club pages) aren't authored-and-dated
	// news events, so the byline/date chrome is suppressed for them (#37,
	// ADR-0009).
	const suppress_news_chrome = article.article_kind === "content";

	return (
		<>
			<TableOfContents entries={headings} />
			{/* Desktop previously wrapped this in `Card`/`CardHeader`/`CardContent`,
			but with `border-0 bg-transparent shadow-none` those contributed no
			visible chrome -- only padding -- so the responsive difference is
			reproduced here via `md:p-6` on a plain wrapper instead of
			rendering the whole subtree twice (which duplicated every heading id
			and broke `getElementById`-based scroll-spy on mobile). The title→body
			gap is an explicit flex `gap` rather than heading margins: the `h1`
			sits in a flex column, where margins never collapse with siblings, so
			leaving `.prose`'s default h1 margin-bottom in play stacked with the
			first body heading's own margin-top and produced an oversized gap
			whenever the body opened with an h2/h3 instead of a paragraph. */}
			{/* gap-6 */}
			<div className="flex flex-col pt-8 md:p-6">
				<div className="flex flex-col gap-1.5">
					<h1
						id={h1_id}
						className="mb-0"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: `heading` is sanitized via sanitize_inline_html (DOMPurify) in EditorToReact above
						dangerouslySetInnerHTML={{
							__html: heading ?? "Untitled",
						}}
					/>
					{!suppress_news_chrome && (
						<ArticleDescription
							type="page"
							author_ids={author_ids}
							date={article.published_at ?? article.created_at}
						/>
					)}
				</div>
				<ArticleBody blocks_data={blocks_data} />
			</div>
		</>
	);
}

const DOUBLE_IMAGES = true as boolean;
const SMALL_IMAGE_THRESHOLD = 500;

// Small inline images render too tiny at their real pixel size, so the editor
// preview doubles them for display. The gallery lightbox mirrors this so a
// thumbnail and its opened lightbox image feel like the same size.
function get_effective_dimensions(file: { width?: number; height?: number }): {
	width: number;
	height: number;
	dimensions_exist: boolean;
} {
	if (!file.width || !file.height)
		return { width: 1500, height: 1000, dimensions_exist: false };

	const should_double =
		DOUBLE_IMAGES &&
		file.width < SMALL_IMAGE_THRESHOLD &&
		file.height < SMALL_IMAGE_THRESHOLD;

	return {
		width: should_double ? file.width * 2 : file.width,
		height: should_double ? file.height * 2 : file.height,
		dimensions_exist: true,
	};
}

export const NextImageRenderer: RenderFn<EditorJSImageData> = ({
	data,
	className,
}) => {
	const image_props = useMemo(
		() => get_effective_dimensions(data.file),
		[data.file],
	);
	const gallery_images = useGalleryImages();

	return (
		<figure className="max-h-[1500] max-w-[1500]">
			<Image
				onClick={() => {
					// registerImages already computed this image's effective
					// dimensions when building the gallery's image list — reuse
					// that instead of recomputing get_effective_dimensions here.
					const registered = gallery_images.find(
						(image) => image.file.url === data.file.url,
					);
					gallery_store.getState().openImage(
						registered ?? {
							...data,
							file: {
								...data.file,
								width: image_props.width,
								height: image_props.height,
							},
						},
					);
				}}
				className={cn(
					"cursor-pointer",
					className,
					!image_props.dimensions_exist && "object-contain",
				)}
				alt={data.caption || "Slika"}
				src={data.file.url}
				width={image_props.width}
				height={image_props.height}
				priority={true}
			/>
			<figcaption>{HTMLReactParser(data.caption)}</figcaption>
		</figure>
	);
};

const HEADING_TAGS = { 2: "h2", 3: "h3" } as const;

export const HeaderRenderer: RenderFn<{
	text: string;
	level: number;
	toc_id?: string;
}> = ({ data, className }) => {
	const tag = HEADING_TAGS[data.level as 2 | 3] ?? `h${data.level}`;

	return createElement(tag, {
		id: data.toc_id,
		className,
		dangerouslySetInnerHTML: { __html: sanitize_inline_html(data.text) },
	});
};

// @editorjs/table (config: withHeadings: true) always saves `content` plus
// `withHeadings`; it never emits `header`/`footer`/`caption` — those are
// other table tools' fields, kept optional here since the renderer package's
// type allows for them.
interface EditorJSTableData {
	content: string[][];
	withHeadings?: boolean;
	header?: string[];
	footer?: string[];
	caption?: string;
}

export const TableRenderer: RenderFn<EditorJSTableData> = ({ data }) => {
	const rows = data.withHeadings ? data.content.slice(1) : data.content;
	const heading_row = data.withHeadings ? data.content[0] : data.header;

	return (
		<Table className="border-collapse">
			{data.caption && (
				<TableCaption>{HTMLReactParser(data.caption)}</TableCaption>
			)}
			{heading_row && (
				<TableHeader>
					<TableRow>
						{heading_row.map((cell, i) => (
							<TableHead
								// biome-ignore lint/suspicious/noArrayIndexKey: table columns are positional and never reordered
								key={i}
								variant="article"
								// @editorjs/table's "With headings" toggle bolds the header row via
								// CSS only (`tc-table--heading`) — it never inserts a <b> tag into
								// the cell content, so this has to be applied here too rather than
								// relying on the cell's HTML.
								className={data.withHeadings ? "font-bold" : undefined}
							>
								{HTMLReactParser(cell)}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
			)}
			<TableBody>
				{rows.map((row, row_index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: table rows are positional and never reordered
					<TableRow key={row_index}>
						{row.map((cell, cell_index) => (
							<TableCell
								// biome-ignore lint/suspicious/noArrayIndexKey: table columns are positional and never reordered
								key={cell_index}
								variant="article"
							>
								{HTMLReactParser(cell)}
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
};

interface EditorJSAttachesData {
	file: {
		url: string;
		size: number;
		name: string;
		extension?: string;
	};
	title: string;
}

const EXTENSION_MAX_LENGTH = 4;

export const AttachesRenderer: RenderFn<EditorJSAttachesData> = ({
	data,
	className,
}) => {
	const extension = useMemo(() => {
		if (!data.file.extension) return "";
		let visible_extension = data.file.extension.trim().toUpperCase();

		if (data.file.extension.length > EXTENSION_MAX_LENGTH) {
			visible_extension = `${data.file.extension.substring(0, EXTENSION_MAX_LENGTH).toUpperCase()}…`;
		}

		return visible_extension;
	}, [data.file.extension]);

	const backgroundColor = useMemo(() => {
		const ext = data.file.extension;
		if (!ext) return "#333";
		return _EXTENSIONS[ext] ?? "#333";
	}, [data.file.extension]);

	return (
		<Link
			className={cn(className, "cdx-attaches cdx-attaches--with-file")}
			href={data.file.url}
			target="_blank"
		>
			<div className="cdx-attaches__file-icon">
				<div
					className="cdx-attaches__file-icon-background"
					style={{ backgroundColor }}
				></div>
				<div
					className="cdx-attaches__file-icon-label"
					title="json"
					style={{ backgroundColor }}
				>
					{extension}
				</div>
			</div>
			<div className="cdx-attaches__file-info">
				<div className="cdx-attaches__title">{data.title}</div>
				<div className="cdx-attaches__size">
					{human_file_size(data.file.size)}
				</div>
			</div>

			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				fill="none"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke="currentColor"
					strokeLinecap="round"
					strokeWidth={2}
					d="M7 10L11.8586 14.8586C11.9367 14.9367 12.0633 14.9367 12.1414 14.8586L17 10"
				></path>
			</svg>
		</Link>
	);
};

// https://github.com/editor-js/attaches
const _EXTENSIONS: Record<string, string> = {
	doc: "#1483E9",
	docx: "#1483E9",
	odt: "#1483E9",
	pdf: "#DB2F2F",
	rtf: "#744FDC",
	tex: "#5a5a5b",
	txt: "#5a5a5b",
	pptx: "#E35200",
	ppt: "#E35200",
	mp3: "#eab456",
	mp4: "#f676a6",
	xls: "#11AE3D",
	html: "#2988f0",
	htm: "#2988f0",
	png: "#AA2284",
	jpg: "#D13359",
	jpeg: "#D13359",
	gif: "#f6af76",
	zip: "#4f566f",
	rar: "#4f566f",
	exe: "#e26f6f",
	svg: "#bf5252",
	key: "#00B2FF",
	sketch: "#FFC700",
	ai: "#FB601D",
	psd: "#388ae5",
	dmg: "#e26f6f",
	json: "#2988f0",
	csv: "#11AE3D",
};
