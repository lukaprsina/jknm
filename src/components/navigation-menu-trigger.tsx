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
};

export const NavigationMenuTrigger = React.forwardRef<
	React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
	NavigationMenuTriggerProps
>(
	(
		{ className, children, href, hasContent = false, onClick, ...props },
		ref,
	) => {
		// Fix: When hovering the trigger and clicking, it opens and closes.
		// This adds a timer which ignores the click, modified from
		// https://github.com/radix-ui/primitives/issues/1630#issuecomment-1545995075

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
		}, [forwarded_ref]);

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
						// Dropdown is closed: open it instead of navigating.
						e.preventDefault();
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
