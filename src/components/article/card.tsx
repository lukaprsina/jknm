"use client";

import { AspectRatio } from "@radix-ui/react-aspect-ratio";
import Link from "next/link";
import { useState } from "react";
import { CardHeader, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { IntersectionRef } from "./infinite-articles";
import { MagicCard } from "../magic-card";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Skeleton } from "../ui/skeleton";

// import ArticleDescription from "./description/card-description";
const ArticleDescription = dynamic(() => import("./description"), {
  ssr: false,
  loading: () => <Skeleton className="h-[1em] w-[300px] bg-[hsl(0_0%_90%)]" />,
});

export function ArticleCard({
  featured,
  title,
  url,
  content_preview,
  created_at,
  has_thumbnail,
  image_url,
  author_ids,
  ref,
}: {
  featured?: boolean;
  title: string;
  url: string;
  content_preview?: string;
  created_at: Date;
  has_thumbnail: boolean;
  image_url?: string;
  author_ids: number[];
  ref?: IntersectionRef;
}) {
  const [hover, setHover] = useState(false);

  return (
    <Link
      href={url}
      className={cn(
        "overflow-hidden rounded-xl bg-transparent no-underline shadow-lg",
        featured && "col-span-1 md:col-span-2 lg:col-span-3",
      )}
      prefetch={false}
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <MagicCard
        className="flex h-full flex-col"
        innerClassName="h-full"
        gradientColor="#D9D9D955"
      >
        {has_thumbnail && image_url ? (
          <AspectRatio
            ratio={16 / 9}
            className={cn(
              "relative rounded-md transition-transform",
              hover ? "scale-[1.01]" : null,
            )}
          >
            <Image
              // https://jknm.s3.eu-central-1.amazonaws.com/potop-v-termalni-izvir-29-02-2008/1_gradbena%20jama.jpg
              // https://jknm.s3.eu-central-1.amazonaws.com/potop-v-termalni-izvir-29-02-2008/thumbnail.jpg
              // https://jknm-draft.s3.eu-central-1.amazonaws.com//uredi/41/thumbnail.png
              src={image_url}
              alt={title}
              fill
              // loader={({ src }) => src}
              priority={featured}
              className="rounded-md object-cover"
            />
          </AspectRatio>
        ) : null}
        {/* TODO: prose-h3:text-xl prose-h3:font-semibold*/}
        <div className="h-full">
          <CardHeader>
            <h3
              className="line-clamp-2 h-[3em]"
              dangerouslySetInnerHTML={{
                __html: title,
              }}
            />
            <div className="flex w-full justify-between gap-2">
              <ArticleDescription
                type={featured ? "card-featured" : "card"}
                author_ids={author_ids}
                created_at={created_at}
              />
            </div>
          </CardHeader>
          <CardContent className="">
            <div className="h-full">
              <p
                className={cn(
                  "relative line-clamp-3 items-end",
                  !has_thumbnail && "line-clamp-4",
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
