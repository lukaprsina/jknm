import type { MDXComponents } from "mdx/types";
import type { ImageSize } from "~/components/image-with-caption";
import { ImageWithCaption } from "~/components/image-with-caption";
import { TableOfContents } from "~/components/static/toc-scroll";
import fs from "fs";

const image_sizes_string = fs.readFileSync("image_sizes.json", "utf-8");
const image_sizes = JSON.parse(image_sizes_string) as ImageSize[];

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    strong: (props) => <b {...props} />,
    // TODO: add links
    TableOfContents,
    Image: (props) => <ImageWithCaption image_sizes={image_sizes} {...props} />,
    ...components,
  };
}
