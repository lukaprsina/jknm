"use client";

import React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cn } from "~/lib/utils";
import { navigationMenuTriggerStyle } from "./ui/navigation-menu";

export const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger> & {
    delayDuration?: number;
  }
>(({ className, children, onClick, delayDuration = 150, ...props }, ref) => {
  const [isDelaying, setIsDelaying] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // If we're in delay period, ignore the click
      if (isDelaying) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    },
    [isDelaying, onClick],
  );

  const handleMouseEnter = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setIsDelaying(true);

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset delay after specified duration
      timeoutRef.current = setTimeout(() => {
        setIsDelaying(false);
      }, delayDuration);

      props.onMouseEnter?.(event);
    },
    [delayDuration, props],
  );

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <NavigationMenuPrimitive.Trigger
      ref={ref}
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </NavigationMenuPrimitive.Trigger>
  );
});
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;
