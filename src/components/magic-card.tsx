"use client";

import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import type React from "react";
import { useCallback, useEffect } from "react";
import { cn } from "~/lib/utils";

export interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
	gradientSize?: number;
	gradientColor?: string;
	gradientOpacity?: number;
	innerClassName?: string;
}

export function MagicCard({
	children,
	className,
	innerClassName,
	gradientSize = 200,
	gradientColor = "#D9D9D955",
	gradientOpacity = 0.8,
}: MagicCardProps) {
	const mouseX = useMotionValue(-gradientSize);
	const mouseY = useMotionValue(-gradientSize);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const { left, top } = e.currentTarget.getBoundingClientRect();
			mouseX.set(e.clientX - left);
			mouseY.set(e.clientY - top);
		},
		[mouseX, mouseY],
	);

	const handleMouseLeave = useCallback(() => {
		mouseX.set(-gradientSize);
		mouseY.set(-gradientSize);
	}, [mouseX, mouseY, gradientSize]);

	useEffect(() => {
		mouseX.set(-gradientSize);
		mouseY.set(-gradientSize);
	}, [mouseX, mouseY, gradientSize]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: purely a decorative cursor-follow gradient, no functional interaction
		<div
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			className={cn(
				"group relative flex size-full overflow-hidden rounded-xl border text-black dark:bg-neutral-900 dark:text-white",
				// "bg-neutral-100", // 92.2%
				// "bg-neutral-200", // 97%
				"bg-[oklch(94.6%_0_0)]",
				className,
			)}
		>
			<div className={cn("relative z-10", innerClassName)}>{children}</div>
			<motion.div
				className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				style={{
					background: useMotionTemplate`
            radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)
          `,
					opacity: gradientOpacity,
					// mixBlendMode: "multiply",
				}}
			/>
		</div>
	);
}
