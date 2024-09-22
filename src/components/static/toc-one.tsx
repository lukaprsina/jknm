import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { useEffect, useState } from "react";


const useTocHighlight = (toc: Toc) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);

        if (visibleEntries.length > 0) {
          const visibleEntry = visibleEntries[0];
          const id = visibleEntry?.target.getAttribute("id");
          if (id) setActiveId(id);
        }
      },
      { rootMargin: "0px 0px -50% 0px", threshold: 0.5 }, // Adjust rootMargin and threshold to tweak when sections are considered "active"
    );

    const elements = document.querySelectorAll("h2, h3, h4, h5, h6");
    elements.forEach((element) => observer.observe(element));

    return () => {
      elements.forEach((element) => observer.unobserve(element));
    };
  }, [toc]);

  return activeId;
};


export function TableOfContents({ tableOfContents }: { tableOfContents: Toc }) {
  const activeId = useTocHighlight(tableOfContents);

  useEffect(() => {
    console.log("activeId", activeId);
  }, [activeId]);

  const renderToc = (entries: Toc) => (
    <ul>
      {entries.map((entry) => (
        <li key={entry.id} className={entry.id === activeId ? "active" : ""}>
          <a href={`#${entry.id}`}>{entry.value}</a>
          {entry.children && renderToc(entry.children)}
        </li>
      ))}
    </ul>
  );

  return <nav>{renderToc(tableOfContents)}</nav>;
}