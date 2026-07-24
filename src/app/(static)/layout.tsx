import type React from "react";
import { ImageGallery } from "~/components/image-gallery";
import { Shell } from "~/components/shell";
import ScrollToTop from "~/components/shell/scroll-to-top";
import { ScrollProvider } from "~/contexts/scroll-context";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";

export default function MarkdownLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<Shell>
			<ScrollProvider>
				<div className={cn(article_variants(), page_variants())}>
					{children}
					<ImageGallery />
				</div>
				<ScrollToTop />
			</ScrollProvider>
		</Shell>
	);
}
