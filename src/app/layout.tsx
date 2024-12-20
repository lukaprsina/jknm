import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { TooltipProvider } from "~/components/ui/tooltip";
import { Toaster } from "~/components/ui/toaster";
import { cn } from "~/lib/utils";
import { GeistMono } from "geist/font/mono";
import { StrictMode } from "react";
import Providers from "./provider";
import {
  cachedAllAuthors,
  cachedDuplicateUrls,
} from "~/server/cached-global-state";

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
  // await api.draft_article.get_duplicate_urls.prefetch();
  const [all_authors, duplicate_urls] = await Promise.all([
    cachedAllAuthors(),
    cachedDuplicateUrls(),
  ]);

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
          <Providers all_authors={all_authors} duplicate_urls={duplicate_urls}>
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
