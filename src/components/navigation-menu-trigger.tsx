"use client";

import React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cn } from "~/lib/utils";
import { navigationMenuTriggerStyle } from "./ui/navigation-menu";

export const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, onClick, ...props }, ref) => {
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // If we're in the middle of a transition, ignore the click
      if (isTransitioning) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    },
    [isTransitioning, onClick],
  );

  React.useEffect(() => {
    const element = ref && "current" in ref ? ref.current : null;
    if (!element) return;

    const handleTransitionStart = () => {
      setIsTransitioning(true);
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Reset after a short delay to account for the opening animation
      timeoutRef.current = setTimeout(() => {
        setIsTransitioning(false);
      }, 200);
    };

    const handleTransitionEnd = () => {
      setIsTransitioning(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    // Listen for data-state changes which indicate transitions
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-state"
        ) {
          const newState = element.getAttribute("data-state");
          if (newState === "open") {
            handleTransitionStart();
          } else if (newState === "closed") {
            handleTransitionEnd();
          }
        }
      });
    });

    observer.observe(element, {
      attributes: true,
      attributeFilter: ["data-state"],
    });

    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [ref]);

  return (
    <NavigationMenuPrimitive.Trigger
      ref={ref}
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </NavigationMenuPrimitive.Trigger>
  );
});
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;
