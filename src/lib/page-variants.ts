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

export const page_variants = cva("container h-full w-full pb-6 pt-8");
