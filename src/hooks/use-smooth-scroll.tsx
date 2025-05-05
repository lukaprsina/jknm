import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { shell_store } from "~/components/shell/desktop-header";
import { mobile_nav_store } from "~/components/shell/mobile-header";

type SmoothScrollType = {
  test_href: string | null;
  id: string | null;
};

export const smooth_scroll_store = create<SmoothScrollType>()(
  persist(
    () =>
      ({
        test_href: "",
        id: "",
      }) as SmoothScrollType,
    { name: "smooth-scroll" },
  ),
);

// smooth scroll with offset for the sticky navbar
export function useSmoothScroll() {
  const pathname = usePathname();
  const testhref = smooth_scroll_store((state) => state.test_href);
  const id = smooth_scroll_store((state) => state.id);

  useEffect(() => {
    if (testhref !== pathname) return;
    if (!id) return;

    const anchor = document.getElementById(id);
    if (!anchor) return;
    const navbar_height = shell_store.getState().navbar_height;
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

    mobile_nav_store.setState({ open: false });
    window.scrollTo({ top: yPosition, behavior: "instant" });

    smooth_scroll_store.setState({ id: null, test_href: null });
  }, [id, pathname, testhref]);

  return null;
}
