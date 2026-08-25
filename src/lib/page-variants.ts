import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

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
			padding: "none",
		},
	},
);

/** Horizontal gutter shared by every page's content column and the header —
 * `container` (mx-auto) + a max-width + matching inline padding, with no
 * vertical spacing so callers that aren't a top-level page (e.g. the header)
 * can reuse the exact same edges. */
export const page_gutter_variants = cva("container h-full w-full", {
	variants: {
		max_width: {
			normal: "max-w-[848px]",
			wide: "max-w-[1280px]",
		},
		padding: {
			normal: "px-[1em] md:px-[2em]",
			none: "",
		},
	},
	defaultVariants: {
		padding: "normal",
		max_width: "normal",
	},
});

export function page_variants(
	opts?: VariantProps<typeof page_gutter_variants>,
) {
	return cn(page_gutter_variants(opts), "pb-6 pt-8");
}
