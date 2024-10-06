import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { createStore } from "zustand-x";
import { shell_store } from "~/components/shell/desktop-header";
import { mobile_nav_store } from "~/components/shell/mobile-header";

export const smooth_scroll_store = createStore("smooth-scroll")<{
  test_href: string | null;
  id: string | null;
}>(
  {
    test_href: "",
    id: "",
  },
  {
    persist: { enabled: true },
  },
).extendActions((set) => ({
  set_both: (test_href: string | null, id: string | null) => {
    set.test_href(test_href);
    set.id(id);
  },
}));

// smooth scroll with offset for the sticky navbar
export function useSmoothScroll() {
  const pathname = usePathname();
  const testhref = smooth_scroll_store.use.test_href();
  const id = smooth_scroll_store.use.id();

  useEffect(() => {
    if (testhref !== pathname) return;
    if (!id) return;

    const anchor = document.getElementById(id);
    if (!anchor) return;
    const navbar_height = shell_store.get.navbar_height();
    // console.log("smooth scroll", { id, navbar_height });
    if (typeof navbar_height !== "number") return;

    const yOffset = -navbar_height; // offset by navbar height
    const yPosition =
      anchor.getBoundingClientRect().top + window.scrollY + yOffset;

    console.log("smooth scroll effect", {
      id,
      pathname,
      testhref,
      navbar_height,
      yPosition,
    });

    mobile_nav_store.set.open(false);
    window.scrollTo({ top: yPosition, behavior: "instant" });

    smooth_scroll_store.set.set_both(null, null);
  }, [id, pathname, testhref]);

  return null;
}
