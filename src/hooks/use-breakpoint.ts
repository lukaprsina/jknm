import { create } from "@kodingdotninja/use-tailwind-breakpoint";

const screens = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
  not_center: "1880px",
} as const;

export const { useBreakpoint } = create(screens);
