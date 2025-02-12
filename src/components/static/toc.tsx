"use client";

import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { useEffect, useState } from "react";

function get_toc_ids(toc: Toc): string[] {
  const ids: string[] = [];
  for (const heading of toc) {
    if (heading.id) {
      ids.push(heading.id);
    }

    if (heading.children) {
      ids.push(...get_toc_ids(heading.children));
    }
  }
  return ids;
}

function get_heading_depth(toc: Toc, target_id: string): number | undefined {
  for (const heading of toc) {
    if (heading.id === target_id) {
      return heading.depth;
    }

    if (heading.children) {
      const depth = get_heading_depth(heading.children, target_id);
      if (depth) return depth;
    }
  }
}

const useActiveHeading = (toc: Toc) => {
  const [activeHeadings, setActiveHeadings] = useState<Record<number, string>>(
    {},
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("id");
          if (!id) return;

          const depth = get_heading_depth(toc, id);
          if (typeof depth === "undefined") return;

          if (entry.isIntersecting) {
            setActiveHeadings((prev) => ({
              ...prev,
              [depth]: id,
            }));
          } else if (activeHeadings[depth] === id) {
            setActiveHeadings((prev) => {
              const newState = { ...prev };
              delete newState[depth];
              return newState;
            });
          }
        });
      },
      { threshold: 0 },
      // { rootMargin: "0px 0px -50% 0px" }, // Adjust this threshold based on when you want to trigger visibility
    );

    const headingElements = get_toc_ids(toc).map((id) =>
      document.getElementById(id),
    );

    headingElements.forEach((element) => element && observer.observe(element));

    return () => {
      headingElements.forEach(
        (element) => element && observer.unobserve(element),
      );
    };
  }, [toc, activeHeadings]);

  return activeHeadings;
};

export function TableOfContents({ tableOfContents }: { tableOfContents: Toc }) {
  const activeHeadings = useActiveHeading(tableOfContents);

  console.log("TableOfContents", activeHeadings);

  const renderToc = (entries: Toc, depth = 1) => {
    return (
      <ul>
        {entries.map((entry) => {
          // const isActive = false as boolean;
          const isActive = activeHeadings[depth] === entry.id;

          return (
            <li
              key={entry.id}
              className={isActive ? "border-l-2 border-blue-500" : ""}
            >
              <a href={`#${entry.id}`}>{entry.value}</a>
              {entry.children && renderToc(entry.children, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return <aside>{renderToc(tableOfContents)}</aside>;
}
