"use client";

import { usePagination } from "react-instantsearch";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination";

export function MyPagination() {
  const {
    pages,
    currentRefinement,
    // nbHits,
    nbPages,
    isFirstPage,
    isLastPage,
    // canRefine,
    refine,
    createURL,
  } = usePagination();

  const firstPageIndex = 0;
  const previousPageIndex = currentRefinement - 1;
  const nextPageIndex = currentRefinement + 1;
  const lastPageIndex = nbPages - 1;

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            isActive={!isFirstPage}
            href={createURL(firstPageIndex)}
            onClick={() => refine(firstPageIndex)}
          >
            Prva
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationPrevious
            isActive={!isFirstPage}
            href={createURL(previousPageIndex)}
            onClick={() => refine(previousPageIndex)}
          >
            Prejšnja
          </PaginationPrevious>
        </PaginationItem>
        {pages.map((page) => {
          const label = page + 1;

          return (
            <PaginationItem key={page}>
              <PaginationLink
                isActive={true}
                href={createURL(page)}
                onClick={() => refine(page)}
              >
                {label}
              </PaginationLink>
            </PaginationItem>
          );
        })}
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink
            isActive={!isLastPage}
            href={createURL(nextPageIndex)}
            onClick={() => refine(nextPageIndex)}
          >
            Naslednja
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            isActive={!isLastPage}
            href={createURL(lastPageIndex)}
            onClick={() => refine(lastPageIndex)}
          >
            Zadnja
          </PaginationNext>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
