import { cva } from "class-variance-authority";

export const article_variants = cva(
  "prose dark:prose-invert prose-figcaption:text-base prose-figcaption:text-blue-800",
  {
    variants: {
      variant: {
        normal: "",
        card: "prose-img:m-0 prose-h3:my-0 prose-h3:py-0 prose-p:m-0",
      },
    },
    defaultVariants: {
      variant: "normal",
    },
  },
);

export const article_grid_variants = cva(
  "grid grid-cols-1 gap-6 py-8 md:grid-cols-2 lg:grid-cols-3 ",
  {
    variants: {
      padding: {
        normal: "px-4 md:px-6 lg:px-8",
        none: "",
      },
    },
    defaultVariants: {
      padding: "normal",
    },
  },
);

export const page_variants = cva("container h-full w-full pb-6 pt-8");
