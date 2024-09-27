"use client";

import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { shell_store } from "~/components/shell/desktop-header";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useBreakpoint } from "~/hooks/use-breakpoint";

function get_heading_ids(toc: Toc): string[] {
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

const SCROLL_CALLBACK_THROTTLE_TIME = 80;
const HEIGHT_CONSTANT = 150; // 75

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
      anchor_top + HEIGHT_CONSTANT > scrollTop
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
    <>
      {tableOfContents.map((entry) => {
        if (!entry.id) return null;

        return (
          <Fragment key={entry.id}>
            <Link
              className={cn(
                // "block text-sm font-medium text-gray-900",
                "block border-l-2 border-transparent",
                entry.depth > 1 && "border-gray-200",
                activeAnchors.includes(entry.id) && "border-black",
              )}
              style={{ paddingLeft: `${entry.depth * 16}px` }}
              href={`#${entry.id}`}
              key={entry.id}
              onClick={(e) => {
                // smooth scroll with offset for the sticky navbar
                e.preventDefault();
                if (!entry.id) return;

                const anchor = document.getElementById(entry.id);
                if (!anchor) return;
                const navbar_height = shell_store.get.navbar_height();
                if (typeof navbar_height !== "number") return;

                const yOffset = -navbar_height; // offset by navbar height
                const yPosition =
                  anchor.getBoundingClientRect().top + window.scrollY + yOffset;

                window.scrollTo({ top: yPosition, behavior: "smooth" });
              }}
            >
              {entry.value}
            </Link>

            {entry.children && (
              <TocTree
                activeAnchors={activeAnchors}
                tableOfContents={entry.children}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function TocPortal({
  tableOfContents,
  activeAnchors,
}: {
  activeAnchors: string[];
  tableOfContents: Toc;
}) {
  const div_ref = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={div_ref} className={cn("flex h-full w-full justify-start")}>
      <ScrollArea
        className={cn(
          "text-sm",
          "h-[calc(100vh_-_72px)] max-w-[300px] overflow-auto pb-8 pt-4",
        )}
      >
        <TocTree
          activeAnchors={activeAnchors}
          tableOfContents={tableOfContents}
        />
      </ScrollArea>
    </div>
  );
}

export function TableOfContents({ tableOfContents }: { tableOfContents: Toc }) {
  const [activeAnchors, setActiveAnchors] = useState<string[]>([]);
  const aside_ref = useRef<HTMLElement | null>(null);
  const mobile_ref = useRef<HTMLElement | null>(null);
  const main_ref = useRef<HTMLElement | null>(null);
  const md_breakpoint = useBreakpoint("md");

  useEffect(() => {
    main_ref.current = document.getElementById("shell-main");
    aside_ref.current = document.getElementById("shell-aside");
    mobile_ref.current = document.getElementById("mobile-toc");
  }, []);

  const scroll_callback = useThrottle(() => {
    console.log("scroll_callback");
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
  }, SCROLL_CALLBACK_THROTTLE_TIME);

  useEffect(() => {
    scroll_callback();
  }, [scroll_callback]);

  useEffect(() => {
    addEventListener("scroll", scroll_callback);
    return () => removeEventListener("scroll", scroll_callback);
  }, [scroll_callback]);

  const portal = useCallback(() => {
    let element: HTMLElement | null = null;
    if (md_breakpoint) {
      element = aside_ref.current;
    } else {
      element = mobile_ref.current;
    }
    console.log("portal", { element, aside_ref, mobile_ref, md_breakpoint });

    if (!element) return null;

    return createPortal(
      <TocPortal
        activeAnchors={activeAnchors}
        tableOfContents={tableOfContents}
      />,
      element,
    );
  }, [activeAnchors, md_breakpoint, tableOfContents]);

  return portal();
}

const useThrottle = (callback: (...args: unknown[]) => void, limit: number) => {
  const lastCallRef = useRef<number>(0);
  return useCallback(
    (...args: unknown[]) => {
      const now = Date.now();
      if (now - lastCallRef.current >= limit) {
        lastCallRef.current = now;
        callback(...args);
      }
    },
    [callback, limit],
  );
};
