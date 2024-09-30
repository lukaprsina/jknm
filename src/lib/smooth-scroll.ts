import { shell_store } from "~/components/shell/desktop-header";
import { mobile_nav_store } from "~/components/shell/mobile-header";

// smooth scroll with offset for the sticky navbar
export function smooth_scroll(id: string) {
  const anchor = document.getElementById(id);
  console.log("smooth scrolling", { id, anchor });
  if (!anchor) return;
  const navbar_height = shell_store.get.navbar_height();
  if (typeof navbar_height !== "number") return;

  const yOffset = -navbar_height; // offset by navbar height
  const yPosition =
    anchor.getBoundingClientRect().top + window.scrollY + yOffset;

  console.log("scrolling", { yPosition, yOffset });
  mobile_nav_store.set.open(false);
  window.scrollTo({ top: yPosition, behavior: "smooth" });
}
