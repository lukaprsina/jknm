"use client";

import React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import useForwardedRef from "~/hooks/use-forwarded-ref";
import { cn } from "~/lib/utils";
import { navigationMenuTriggerStyle } from "./ui/navigation-menu";

export const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, onClick, ...props }, ref) => {
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
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      onClick={(e) => {
        if (disable) e.preventDefault();

        if (onClick) onClick(e);
      }}
      {...props}
    >
      {children}{" "}
      {/* <ChevronDownIcon
        className="relative top-[1px] ml-1 h-3 w-3 transition duration-300 group-data-[state=open]:rotate-180"
        aria-hidden="true"
      /> */}
    </NavigationMenuPrimitive.Trigger>
  );
});
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;
