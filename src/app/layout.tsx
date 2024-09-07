import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { TRPCReactProvider } from "~/trpc/react";
import { api, HydrateClient } from "~/trpc/server";
import { TooltipProvider } from "~/components/ui/tooltip";
import { Toaster } from "~/components/ui/toaster";
import { cn } from "~/lib/utils";
import { GeistMono } from "geist/font/mono";
import { StrictMode } from "react";

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
  await api.author.get_all.prefetch();
  await api.article.get_duplicate_urls.prefetch();

  return (
    <StrictMode>
      <html lang="en" className={`${GeistSans.variable}`}>
        <body
          className={cn(
            "font-sans antialiased",
            open_sans.variable,
            GeistMono.variable,
          )}
        >
          <TRPCReactProvider>
            <HydrateClient>
              <TooltipProvider>
                {children}
                <Toaster />
                <SpeedInsights />
              </TooltipProvider>
            </HydrateClient>
          </TRPCReactProvider>
        </body>
      </html>
    </StrictMode>
  );
}
