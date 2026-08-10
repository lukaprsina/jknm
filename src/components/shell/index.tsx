import type React from "react";
import { Suspense } from "react";
import { get_static_nav_sections } from "~/lib/static-nav-sections";
import { cn } from "~/lib/utils";
import type { EditableArticleRef } from "../article/new-adapter";
import { Separator } from "../ui/separator";
import { DesktopHeader } from "./desktop-header";
import { EditorControls } from "./editor-controls";
import { Footer } from "./footer";
import { MobileHeader } from "./mobile-header";
import { SearchProvider } from "./search-context";
import { Searchbar } from "./searchbar";
import { TocAwareLayout } from "./toc-aware-layout";

interface ShellProps {
	children: React.ReactNode;
	published_article?: EditableArticleRef;
	without_footer?: boolean;
	without_header?: boolean;
	className?: string;
}

/**
 * The nav-section fetch (`get_static_nav_sections`) is awaited directly
 * rather than behind `<Suspense>` — unlike the session read, it's a cached,
 * cheap lookup (`get_new_article_by_slug` is `unstable_cache`d, tag
 * `"article"`, 1h revalidate, plus request-deduped via React `cache`) that
 * every route needs before the header can render its dropdowns at all, so
 * there's nothing meaningful to stream around it. The session read still
 * streams in behind `<Suspense>` — the fallback is `null` because the
 * editing buttons are admin-only chrome — for the anonymous majority the
 * final render is also nothing, so there is no layout shift to guard
 * against.
 */
export async function Shell({
	published_article,
	children,
	without_footer,
	without_header,
	className,
}: ShellProps) {
	const editor_controls = (
		<Suspense fallback={null}>
			<EditorControls published_article={published_article} />
		</Suspense>
	);

	const nav_sections = await get_static_nav_sections();

	return (
		<SearchProvider>
			<div className={cn("w-full", className)}>
				{!without_header ? (
					<header className="h-20 w-full text-gray-800 md:h-auto">
						<DesktopHeader
							className="hidden md:flex"
							editor_controls={editor_controls}
							nav_sections={nav_sections}
						/>
						<MobileHeader
							className="flex md:hidden"
							editor_controls={editor_controls}
						/>
					</header>
				) : undefined}
				<TocAwareLayout>{children}</TocAwareLayout>
				{without_footer ? undefined : (
					<>
						<Separator />
						<Footer />
					</>
				)}
			</div>
			<Searchbar />
		</SearchProvider>
	);
}
