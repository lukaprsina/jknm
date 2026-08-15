"use client";

import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import Link from "next/link";
import React from "react";
import useForwardedRef from "~/hooks/use-forwarded-ref";
import { cn } from "~/lib/utils";
import { navigationMenuTriggerStyle } from "./ui/navigation-menu";

type NavigationMenuTriggerProps = Omit<
	React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>,
	"asChild"
> & {
	href: string;
	// Whether this trigger has an attached NavigationMenuContent dropdown.
	// Plain (contentless) triggers always navigate on click.
	hasContent?: boolean;
	// Explicitly opens this item's dropdown. Needed because Radix composes
	// our onClick with its own click-to-open handler and skips its handler
	// entirely once ours calls preventDefault() — on mouse that's masked by
	// hover already opening the dropdown before the click fires, but touch
	// has no hover step, so without this the dropdown never opened on tap.
	onOpenRequest?: () => void;
};

export const NavigationMenuTrigger = React.forwardRef<
	React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
	NavigationMenuTriggerProps
>(
	(
		{
			className,
			children,
			href,
			hasContent = false,
			onOpenRequest,
			onClick,
			...props
		},
		ref,
	) => {
		// Fix: When hovering the trigger and clicking, it opens and closes.
		// This adds a timer which ignores the click, modified from
		// https://github.com/radix-ui/primitives/issues/1630#issuecomment-1545995075
		//
		// Only relevant to triggers with a dropdown (`hasContent`): Radix still
		// flips `data-state` to "open" on hover for contentless triggers too
		// (there's just nothing to render), so without gating this on
		// `hasContent`, a plain link could race its own hover-open against an
		// ordinary click and have that click silently cancelled (ADR-0007).

		// init disable state
		const [disable, setDisable] = React.useState(false);
		const forwarded_ref = useForwardedRef(ref);

		type Mutation = MutationRecord & {
			target: {
				dataset?: {
					state: "open" | "closed";
				};
			};
		};

		// Create observer on first render
		React.useEffect(() => {
			if (!hasContent) return;

			// Callback function
			const observerCallback = (mutationsList: Mutation[]) => {
				for (const mutation of mutationsList) {
					if (
						mutation.type === "attributes" &&
						mutation.attributeName === "data-state" &&
						mutation.target.dataset?.state === "open"
					) {
						setDisable(true);
						const timeout = setTimeout(() => {
							setDisable(false);
							clearTimeout(timeout);
						}, 1000);
					}
				}
			};

			// Init MutationObserver
			const observer = new MutationObserver(observerCallback);

			// Add ref nodes to observer watch
			if (forwarded_ref.current) {
				observer.observe(forwarded_ref.current, {
					attributes: true,
				});
			}

			// Disconnect on dismount
			return () => {
				observer.disconnect();
			};
		}, [forwarded_ref, hasContent]);

		return (
			<NavigationMenuPrimitive.Trigger
				ref={forwarded_ref}
				asChild
				className={cn(navigationMenuTriggerStyle(), "group", className)}
				onClick={(e) => {
					const isOpen = forwarded_ref.current?.dataset.state === "open";
					if (hasContent && isOpen) {
						// Dropdown already open: let the click navigate instead of
						// closing it, even if it's within the hover-race guard window
						// below (the click is deliberate, not a hover artifact).
					} else if (disable) {
						// Hover just opened this trigger; ignore the immediately
						// following click so it doesn't toggle straight back closed.
						e.preventDefault();
					} else if (hasContent) {
						// Dropdown is closed: open it instead of navigating. Do this
						// ourselves via onOpenRequest rather than relying on Radix's
						// own composed click handler — that handler is skipped once
						// preventDefault() is called below (composeEventHandlers),
						// which is what left touch taps with no way to open it.
						e.preventDefault();
						onOpenRequest?.();
					}

					if (onClick) onClick(e);
				}}
				{...props}
			>
				<Link href={`/${href}`}>{children}</Link>
			</NavigationMenuPrimitive.Trigger>
		);
	},
);
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;
