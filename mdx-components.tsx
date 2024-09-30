import type { MDXComponents } from "mdx/types";
import type { DetailedHTMLProps, HTMLAttributes } from "react";
import { ImageWithCaption } from "~/components/image-with-caption";
import { TableOfContents } from "~/components/static/toc-scroll";
import { cn } from "~/lib/utils";

function SmoothScrollH2({
  id,
  className,
  ...props
}: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) {
  //
  return (
    // <div id={id} className="mt-[300px]">
    <div id={id} className="absolute left-0 top-[-300px]">
      <h2 className={cn(className, "relative")} {...props} />
    </div>
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    TableOfContents,
    Image: ImageWithCaption,
    h2: SmoothScrollH2,
    ...components,
  };
}
