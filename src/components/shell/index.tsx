import type React from "react";
import { Suspense } from "react";
import { STATIC_NAV_SECTIONS } from "~/lib/static-nav-sections";
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
 * Deliberately synchronous: the shell itself depends on no server data, so it
 * emits immediately and the session read streams in behind `<Suspense>`. The
 * fallback is `null` because the editing buttons are admin-only chrome — for
 * the anonymous majority the final render is also nothing, so there is no
 * layout shift to guard against.
 */
export function Shell({
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

	return (
		<SearchProvider>
			<div className={cn("w-full", className)}>
				{!without_header ? (
					<header className="h-20 w-full text-gray-800 md:h-auto">
						<DesktopHeader
							className="hidden md:flex"
							editor_controls={editor_controls}
							nav_sections={STATIC_NAV_SECTIONS}
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
