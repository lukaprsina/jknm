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
  "grid grid-cols-1 gap-6 px-4 py-8 md:grid-cols-2 md:px-6 lg:grid-cols-3 lg:px-8",
);

export const page_variants = cva("container h-full w-full pb-6 pt-8");
