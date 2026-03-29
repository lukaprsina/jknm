"use client";

import Image, { type ImageProps } from "next/image";
import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";

type SponsorLogo = ImageProps & {
	alt: string;
};

const sponsor_logos: SponsorLogo[] = [
	{
		src: "/sponsors/gen-i.svg",
		alt: "GEN-I",
		width: 612,
		height: 213,
		className: "h-10 w-auto max-w-[10rem] sm:h-12",
	},
	{
		src: "/sponsors/novo-mesto.svg",
		alt: "Mestna občina Novo mesto",
		width: 354,
		height: 209,
		className: "h-10 w-auto max-w-[9rem] sm:h-12",
	},
	{
		src: "/sponsors/protectus.svg",
		alt: "Protectus",
		width: 229,
		height: 66,
		className: "h-10 w-auto max-w-[8rem] sm:h-12",
	},
];

export function Sponsors({
	compact = false,
	className,
	...props
}: ComponentProps<"section"> & {
	compact?: boolean;
}) {
	return (
		<section
			className={cn(
				"not-prose rounded-xl border border-border/60 bg-muted/30 shadow-sm",
				compact ? "px-4 py-4" : "px-5 py-6 md:px-8 md:py-8",
				className,
			)}
			{...props}
		>
			<div className="flex flex-col gap-4">
				<div
					className={cn(
						"flex items-end justify-between gap-3",
						compact && "items-center",
					)}
				>
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
							Sponzorji
						</p>
						<h2
							className={cn(
								"font-semibold text-foreground",
								compact ? "text-sm" : "text-lg",
							)}
						>
							Podpirajo našo dejavnost
						</h2>
					</div>
				</div>

				<div
					className={cn(
						"grid gap-3",
						compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3",
					)}
				>
					{sponsor_logos.map((logo) => (
						<div
							key={logo.src.toString()}
							className={cn(
								"flex items-center justify-center rounded-2xl border border-border/50 bg-background/80 px-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
								compact ? "min-h-20 py-4" : "min-h-24 py-5",
							)}
						>
							<Image
								{...logo}
								unoptimized
								className={cn(
									"h-auto max-h-14 w-auto object-contain transition-transform duration-200 ease-out hover:scale-[1.02]",
									logo.className,
								)}
							/>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
