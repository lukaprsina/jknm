"use client";

import Image, { type ImageProps } from "next/image";
import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";

type SponsorLogo = ImageProps & {
	src: string;
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
		src: "/sponsors/protectus.svg",
		alt: "Protectus",
		width: 229,
		height: 66,
		className: "h-10 w-auto max-w-[8rem] sm:h-12",
	},
	{
		src: "/sponsors/novo-mesto.svg",
		alt: "Mestna občina Novo mesto",
		width: 354,
		height: 209,
		className: "h-10 w-auto max-w-[9rem] sm:h-12",
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
				"not-prose rounded-xl bg-muted/30 shadow-sm",
				compact ? "px-4 py-4" : "px-5 py-6 md:px-8 md:py-8",
				className,
			)}
			{...props}
		>
			<div
				className={cn(
					"grid place-items-center gap-3",
					compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3",
				)}
			>
				{sponsor_logos.map(({ src, alt, width, height, className }) => (
					<Image
						key={src.toString()}
						alt={alt}
						src={src}
						width={width}
						height={height}
						className={cn(
							"h-auto max-h-14 w-auto object-contain transition-transform duration-200 ease-out hover:scale-[1.02]",
							className,
						)}
						unoptimized
					/>
				))}
			</div>
		</section>
	);
}
