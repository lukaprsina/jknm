import type React from "react";
import { cn } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";
import type { EditableArticleRef } from "../article/new-adapter";
import { Separator } from "../ui/separator";
import { DesktopHeader } from "./desktop-header";
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

export async function Shell({
	published_article,
	children,
	without_footer,
	without_header,
	className,
}: ShellProps) {
	const session = await getServerAuthSession();

	return (
		<SearchProvider>
			<div className={cn("w-full", className)}>
				{!without_header ? (
					<header className="h-20 w-full text-gray-800 md:h-auto">
						<DesktopHeader
							published_article={published_article}
							className="hidden md:flex"
							session={session}
						/>
						<MobileHeader
							published_article={published_article}
							className="flex md:hidden"
							session={session}
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
