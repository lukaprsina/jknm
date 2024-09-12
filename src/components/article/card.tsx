"use client";

import { AspectRatio } from "@radix-ui/react-aspect-ratio";
import Link from "next/link";
import { useState } from "react";
import { CardHeader, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { IntersectionRef } from "./infinite-articles";
import { MagicCard } from "../magic-card";
import Image from "next/image";
// import ArticleCardDescription from "./description/card-description";
import dynamic from "next/dynamic";
import { Skeleton } from "../ui/skeleton";
import { env } from "~/env";
import { get_s3_url } from "~/lib/s3-publish";

const ArticleCardDescription = dynamic(
  () => import("./description/card-description"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[1em] w-full bg-[hsl(0_0%_90%)]" />,
  },
);

export function ArticleCard({
  featured,
  title,
  url,
  content_preview,
  created_at,
  has_thumbnail,
  draft,
  author_ids,
  ref,
}: {
  featured?: boolean;
  title: string;
  url: string;
  content_preview?: string;
  created_at: Date;
  has_thumbnail: boolean;
  draft?: boolean;
  author_ids: number[];
  ref?: IntersectionRef;
}) {
  const [hover, setHover] = useState(false);

  const bucket = draft
    ? env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME
    : env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME;

  return (
    <Link
      href={url}
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
        gradientColor="#D9D9D955"
      >
        {has_thumbnail ? (
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
              src={get_s3_url(`${url}/thumbnail.png`, bucket)}
              alt={title}
              fill
              // loader={({ src }) => src}
              priority={featured}
              className="rounded-md object-cover"
            />
          </AspectRatio>
        ) : null}
        <div className="h-full prose-h3:text-xl prose-h3:font-semibold">
          <CardHeader>
            <h3 className="line-clamp-2 h-[56px]">{title}</h3>
            <div className="flex w-full justify-between gap-2">
              <ArticleCardDescription
                author_ids={author_ids}
                featured={featured}
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
