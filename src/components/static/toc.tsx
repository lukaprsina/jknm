"use client";

import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { useEffect, useState } from "react";

const useActiveHeading = (toc: Toc) => {
  const [activeHeadings, setActiveHeadings] = useState<Record<number, string>>(
    {},
  );

  useEffect(() => {
    const headingElements = toc.map((entry) => {
      const test = false as boolean
      if (test || !entry.id) return;
      return document.getElementById(entry.id) ?? undefined;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("id");
          if (!id) return;

          const depth = Number(entry.target.getAttribute("data-depth"));

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
      { rootMargin: "0px 0px -50% 0px" }, // Adjust this threshold based on when you want to trigger visibility
    );

    headingElements.forEach((element) => element && observer.observe(element));

    return () => {
      headingElements.forEach(
        (element) => element && observer.unobserve(element),
      );
    };
  }, [activeHeadings, toc]);

  return activeHeadings;
};

export function TableOfContents({ tableOfContents }: { tableOfContents: Toc }) {
  console.log("TableOfContents", tableOfContents);
  // const activeHeadings = useActiveHeading(tableOfContents);

  const renderToc = (entries: Toc, depth = 1) => {
    return (
      <ul>
        {entries.map((entry) => {
          const isActive = false as boolean;
          // const isActive = activeHeadings[depth] === entry.id;

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
