import "~/styles/globals.css";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { StrictMode } from "react";
import { Toaster } from "~/components/ui/toaster";
import { TooltipProvider } from "~/components/ui/tooltip";
import { SITE_ORIGIN } from "~/lib/site-config";
import { cn } from "~/lib/utils";
import { cachedAllAuthors } from "~/server/cached-global-state";
import Providers from "./provider";

export const metadata: Metadata = {
	// Required for every relative URL-bearing metadata field (canonicals,
	// OG images) elsewhere in the app to resolve at all — Next hard build-
	// errors on a relative URL-based field without this set.
	metadataBase: new URL(SITE_ORIGIN),
	title: {
		default: "Jamarski klub Novo mesto",
		template: "%s | Jamarski klub Novo mesto",
	},
	description:
		"Smo specialisti za dokumentirano raziskovanje in ohranjanje čistega ter zdravega podzemskega sveta.",
	// No `icons` here: `favicon.ico`, `icon0.svg`, `icon1.png`, and
	// `apple-icon.png` in `app/` are auto-detected by Next.js file-based
	// metadata conventions and injected without manual config.
	// No `images` here: X falls back to `og:image` itself when `twitter:image`
	// is absent, so per-page `openGraph.images` (see `novica/[published_url]`)
	// already covers social-card images without duplicating them here.
	twitter: { card: "summary_large_image" },
};

const open_sans = Open_Sans({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-opensans",
});

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const all_authors = await cachedAllAuthors();

	return (
		<StrictMode>
			<html
				// `sl`, not `si`: ISO 639-1 for Slovenian is `sl`. `si` is Sinhala as a
				// language subtag — it's Slovenia's *country* code (ISO 3166), which is
				// not what this attribute takes.
				lang="sl"
				className={`${GeistSans.variable}`}
			>
				<body
					className={cn(
						"font-sans antialiased",
						open_sans.variable,
						GeistMono.variable,
						"scrollbar-gutter-stable",
					)}
				>
					<Providers all_authors={all_authors}>
						<TooltipProvider>
							{children}
							<Toaster />
							<SpeedInsights />
						</TooltipProvider>
					</Providers>
				</body>
			</html>
		</StrictMode>
	);
}
