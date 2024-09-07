"use client";

import { AspectRatio } from "@radix-ui/react-aspect-ratio";
import { DotIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CardHeader, CardDescription, CardContent } from "~/components/ui/card";
import { format_date } from "~/lib/format-date";
import { cn } from "~/lib/utils";
import type { IntersectionRef } from "./infinite-articles";
import { MagicCard } from "../magic-card";
import Image from "next/image";
import { Authors } from "../authors";
import { get_link_from_article } from "~/lib/article-utils";
import { useDuplicatedUrls } from "~/hooks/use-duplicated-urls";

export function ArticleCard({
  featured,
  title,
  url,
  preview_image,
  content_preview,
  created_at,
  author_ids,
  ref,
}: {
  featured?: boolean;
  title: string;
  url: string;
  preview_image?: string;
  content_preview?: string;
  created_at: Date;
  author_ids: number[];
  ref?: IntersectionRef;
}) {
  const [hover, setHover] = useState(false);
  const duplicate_urls = useDuplicatedUrls();

  return (
    <Link
      href={get_link_from_article(url, created_at, duplicate_urls)}
      // rounded-md bg-card
      className={cn(
        "overflow-hidden rounded-xl bg-transparent no-underline shadow-lg",
        featured && "col-span-1 md:col-span-2 lg:col-span-3",
      )}
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <MagicCard
        className="flex h-full flex-col"
        innerClassName="h-full"
        // gradientColor={theme.resolvedTheme === "dark" ? "#262626" : "#D9D9D955"}
        gradientColor="#D9D9D955"
      >
        {preview_image ? (
          <AspectRatio
            ratio={16 / 9}
            className={cn(
              "relative rounded-md transition-transform",
              hover ? "scale-[1.01]" : null,
            )}
          >
            <Image
              src={preview_image}
              alt={title}
              fill
              priority={featured}
              className="rounded-md object-cover"
            />
            {/* {!published && (
              <DraftBadge className="absolute bottom-0 right-0 mx-4 my-6" />
            )} */}
          </AspectRatio>
        ) : null}
        <div className="h-full prose-h3:text-xl prose-h3:font-semibold">
          <CardHeader>
            {/* TODO, hardcodani dve vrstici */}
            <h3 className="line-clamp-2 h-[56px]">{title}</h3>
            <div className="flex w-full justify-between gap-2">
              <CardDescription
                className={cn(
                  "flex w-full items-center gap-3 text-foreground",
                  author_ids.length === 0 ? "justify-end" : "justify-between",
                  featured && author_ids.length !== 0 && "justify-normal gap-0",
                )}
              >
                <span
                  // flex items-center
                  // line-clamp-1 flex-grow-0 flex-nowrap overflow-hidden text-ellipsis text-nowrap
                  // className="flex flex-nowrap items-center justify-start overflow-x-scroll"
                  className="relative line-clamp-1 flex flex-grow-0 flex-nowrap items-center justify-start text-ellipsis text-nowrap"
                >
                  <Authors author_ids={author_ids} />
                </span>
                {featured && author_ids.length !== 0 && <DotIcon size={20} />}
                <span className="flex flex-nowrap text-nowrap">
                  {format_date(created_at)}
                </span>
              </CardDescription>
              {/* {!preview_image && !published && <DraftBadge />} */}
            </div>
          </CardHeader>
          <CardContent className="">
            <div className="h-full">
              <p
                className={cn(
                  "relative line-clamp-3 items-end",
                  !preview_image && "line-clamp-4",
                )}
              >
                {content_preview}
              </p>
            </div>
          </CardContent>
        </div>
      </MagicCard>
    </Link>
  );
}

/* function DraftBadge({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  //   const theme = useTheme();

  return (
    <Badge
      className={cn(
        "shadow-sm shadow-white",
        // theme.resolvedTheme === "dark" ? "shadow-black" : "shadow-white",
        className,
      )}
      {...props}
    >
      Osnutek
    </Badge>
  );
} */
