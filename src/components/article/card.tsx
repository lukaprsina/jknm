"use client";

import { AspectRatio } from "@radix-ui/react-aspect-ratio";
import Link from "next/link";
import { useState } from "react";
import { CardHeader, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { MagicCard } from "../magic-card";
import Image from "next/image";
import type { IntersectionRef } from "~/app/infinite-no-trpc";

import ArticleDescription from "./description";
import { LinkIcon } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "~/hooks/use-toast";
/* const ArticleDescription = dynamic(() => import("./description"), {
  ssr: false,
  loading: () => <Skeleton className="h-[1em] w-[300px] bg-[hsl(0_0%_90%)]" />,
}); */

export function ArticleCard({
  featured,
  title,
  url,
  id,
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
  id?: number;
  content_preview?: string;
  created_at: Date;
  has_thumbnail: boolean;
  image_url?: string;
  author_ids: number[];
  ref?: IntersectionRef;
}) {
  const [hover, setHover] = useState(false);
  const [hoverLink, setHoverLink] = useState(false);
  const toaster = useToast();

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
            <div
              className="flex justify-between gap-2"
              onMouseEnter={() => setHoverLink(true)}
              onMouseLeave={() => setHoverLink(false)}
            >
              <h3
                className="line-clamp-2 h-[3em]"
                dangerouslySetInnerHTML={{
                  __html: title,
                }}
              />
              {typeof id === "number" && (
                <Button
                  className={cn(
                    "flex-shrink-0 opacity-100 transition-opacity",
                    !hoverLink && "opacity-0",
                  )}
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    toaster.toast({
                      title: "Trajna povezava kopirana v odložišče.",
                    });

                    await navigator.clipboard.writeText(
                      `https://jknm.si/novica/?id=${id}`,
                    );
                  }}
                >
                  <LinkIcon size={18} />
                </Button>
              )}
            </div>
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
