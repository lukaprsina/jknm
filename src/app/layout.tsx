import "~/styles/globals.css";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { StrictMode } from "react";
import { Toaster } from "~/components/ui/toaster";
import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { cachedAllAuthors } from "~/server/cached-global-state";
import Providers from "./provider";

export const metadata: Metadata = {
	title: "Jamarski klub Novo mesto",
	description:
		"Smo specialisti za dokumentirano raziskovanje in ohranjanje čistega ter zdravega podzemskega sveta.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
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
			<html lang="en" className={`${GeistSans.variable}`}>
				<body
					className={cn(
						"font-sans antialiased",
						open_sans.variable,
						GeistMono.variable,
					)}
					// style={{scrollbarGutter: "stable"}}
				>
					{/* <TRPCReactProvider> */}
					{/* <HydrateClient> */}
					<Providers all_authors={all_authors}>
						<TooltipProvider>
							{children}
							<Toaster />
							<SpeedInsights />
						</TooltipProvider>
					</Providers>
					{/* </HydrateClient> */}
					{/* </TRPCReactProvider> */}
				</body>
			</html>
		</StrictMode>
	);
}
