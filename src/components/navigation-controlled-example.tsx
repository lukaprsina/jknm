// Example of using controlled NavigationMenu
"use client";

import React from "react";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuLink,
} from "~/components/ui/navigation-menu";
import { NavigationMenuTrigger } from "./navigation-menu-trigger";

export function ControlledNavigation() {
  const [openItem, setOpenItem] = React.useState<string | undefined>();

  return (
    <NavigationMenu value={openItem} onValueChange={setOpenItem}>
      <NavigationMenuList>
        <NavigationMenuItem value="item1">
          <NavigationMenuTrigger
            onMouseEnter={() => {
              // Delay opening to prevent rapid open/close
              setTimeout(() => setOpenItem("item1"), 100);
            }}
          >
            Item 1
          </NavigationMenuTrigger>
          <NavigationMenuContent>{/* Content */}</NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
