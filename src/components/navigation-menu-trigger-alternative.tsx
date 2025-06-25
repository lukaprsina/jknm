// Alternative implementation for more fine-grained control
"use client";

import React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cn } from "~/lib/utils";
import { navigationMenuTriggerStyle } from "./ui/navigation-menu";

export const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, onMouseEnter, onClick, ...props }, ref) => {
  const [isAnimating, setIsAnimating] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsAnimating(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset after animation duration (adjust as needed)
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, 150);

      onMouseEnter?.(e);
    },
    [onMouseEnter],
  );

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isAnimating) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    },
    [isAnimating, onClick],
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
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      {...props}
    >
      {children}
    </NavigationMenuPrimitive.Trigger>
  );
});
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;
