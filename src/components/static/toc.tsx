"use client"

import type { Toc } from "@stefanprobst/rehype-extract-toc";
import { useEffect } from "react";

export function TableOfContents({ tableOfContents }: { tableOfContents: Toc }) {
  console.log(tableOfContents);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("id");
          if (entry.isIntersecting) {
            console.log(`#${id} is in view`);
          } else {
            console.log(`#${id} is out of view`);
          }
        });
      },
      {
        threshold: 0,
      }
    );

    tableOfContents.forEach((entry) => {
        if (!entry.id) {
          return
        }

        const element = document.getElementById(entry.id);
        if (element) {
          observer.observe(element);
        }


        entry.children?.forEach((child) => {
          if (!child.id) {
            return
          }

          const childElement = document.getElementById(child.id);
          if (childElement) {
            observer.observe(childElement);
          }
        })
      }
    );
  }, [tableOfContents]);

  return (
    <nav>
      <h2>Table of Contents</h2>
      <ul>
        {tableOfContents.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`}>{entry.value}</a>
            {entry.children && (
              <ul>
                {entry.children.map((child) => (
                  <li key={child.id}>
                    <a href={`#${child.id}`}>{child.value}</a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}