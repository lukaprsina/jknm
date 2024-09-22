"use client";

import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { useDebounceCallback } from "usehooks-ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "~/lib/utils";

function get_heading_ids(toc: Toc): string[] {
  console.log("get_heading_ids", toc);
  const heading_ids: string[] = [];

  for (const entry of toc) {
    if (!entry.id) continue;

    heading_ids.push(entry.id);
    if (!entry.children) continue;
    const child_headings = get_heading_ids(entry.children);
    heading_ids.push(...child_headings);
  }

  return heading_ids;
}

const SCROLL_CALLBACK_THROTTLE_TIME = 40;

function handle_anchor_highlighting({
  heading_ids,
  scrollTop,
  viewportHeight,
}: {
  heading_ids: string[];
  viewportHeight: number;
  scrollTop: number;
}) {
  const active_anchors: string[] = [];

  for (const heading_id of heading_ids) {
    const anchor = document.getElementById(heading_id);
    if (!anchor) continue;

    const anchor_top = anchor.getBoundingClientRect().top;
    if (
      anchor_top < scrollTop + viewportHeight &&
      anchor_top + 75 > scrollTop
    ) {
      active_anchors.push(heading_id);
    }

    const heading_info = heading_ids
      .map((id) => {
        const element = document.getElementById(id);
        if (!element) return;

        return {
          offsetTop: element.offsetTop,
          id,
        };
      })
      .filter(Boolean) as HTMLElement[];

    const closest_anchor = heading_info.find(
      (anchor) => anchor.offsetTop > scrollTop,
    );

    if (closest_anchor && closest_anchor.offsetTop - 75 > scrollTop) {
      const index = heading_info.findIndex(
        (anchor) => anchor.offsetTop === closest_anchor.offsetTop,
      );

      if (index !== -1) {
        const item = heading_info[index - 1];
        if (item && !active_anchors.includes(item.id)) {
          active_anchors.push(item.id);
        }
      }
    }

    if (!closest_anchor) {
      const last_heading = heading_info.at(-1);
      if (last_heading) active_anchors.push(last_heading.id);
    }
  }

  return active_anchors;
}

function TocTree({
  activeAnchors,
  tableOfContents,
}: {
  activeAnchors: string[];
  tableOfContents: Toc;
}) {
  return (
    <div>
      {tableOfContents.map((entry) => {
        if (!entry.id) return null;

        return (
          <>
            <Link
              className={cn(
                "block border-l-2 border-gray-200 text-sm font-medium text-gray-900",
                activeAnchors.includes(entry.id) && "border-black",
              )}
              style={{ paddingLeft: `${entry.depth * 4}px` }}
              href={`#${entry.id}`}
              key={entry.id}
            >
              {entry.value}
            </Link>

            {entry.children && (
              <TocTree
                activeAnchors={activeAnchors}
                tableOfContents={entry.children}
              />
            )}
          </>
        );
      })}
    </div>
  );
}

export function TableOfContents({ tableOfContents }: { tableOfContents: Toc }) {
  const [activeAnchors, setActiveAnchors] = useState<string[]>([]);
  const aside_ref = useRef<HTMLElement | null>(null);
  const main_ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const possible_main = document.getElementById("shell-main");
    const possible_aside = document.getElementById("shell-aside");
    if (!possible_aside || !possible_main) return;

    main_ref.current = possible_main;
    aside_ref.current = possible_aside;
  }, []);

  // should be throttled
  const scroll_callback = useDebounceCallback(
    () => {
      if (!main_ref.current) return;

      if (tableOfContents.length !== 1) return;
      const first_toc = tableOfContents[0];
      if (!first_toc?.children) return;

      const heading_ids = get_heading_ids(first_toc.children);

      const active_anchors = handle_anchor_highlighting({
        viewportHeight: window.innerHeight,
        heading_ids,
        scrollTop: main_ref.current.scrollTop,
      });

      setActiveAnchors(active_anchors);
    },
    SCROLL_CALLBACK_THROTTLE_TIME,
    { maxWait: SCROLL_CALLBACK_THROTTLE_TIME, leading: true },
  );

  useEffect(() => {
    scroll_callback()
  }, [scroll_callback]);

  useEffect(() => {
    addEventListener("scroll", scroll_callback);
    return () => removeEventListener("scroll", scroll_callback);
  }, [scroll_callback]);

  const portal = useCallback(() => {
    if (!aside_ref.current) return;

    return createPortal(
      <TocTree
        activeAnchors={activeAnchors}
        tableOfContents={tableOfContents}
      />,
      aside_ref.current,
    );
  }, [activeAnchors, tableOfContents]);

  return portal();
}