"use client";

import { useMemo, useState } from "react";
import type {
  ColumnDef,
  PaginationState,
  Row,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useAllAuthors } from "../authors";
import {
  AuthorsTableCellButtons,
  AuthorsTableHeaderButtons,
} from "./authors-table-buttons";

export interface GuestAuthor {
  id: number;
  name: string;
}

export const columns: ColumnDef<GuestAuthor>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row, table }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => {
          row.toggleSelected(!!value);
        }}
        /* onClick={(event) => {
          if (event.shiftKey) {
            const { rows, rowsById } = table.getRowModel();
            const rowsToToggle = get_row_range(
              rows,
              parseInt(row.id),
              parseInt(LAST_SELECTED_ID),
            );
            const isLastSelected = rowsById[LAST_SELECTED_ID]?.getIsSelected();
            rowsToToggle.forEach((row) => row.toggleSelected(isLastSelected));
          }

          LAST_SELECTED_ID = row.id;
        }} */
        onClick={(event) => {
          if (event.shiftKey) {
            const { rows, rowsById } = table.getRowModel();
            const { rowSelection } = table.getState();
            const lastSelectedRowIndex = Math.max(
              ...Object.keys(rowSelection).map(Number),
            );
            const rowsToToggle = get_row_range(
              rows,
              row.index,
              lastSelectedRowIndex,
            );
            const isCellSelected = rowsById[row.id]?.getIsSelected();
            rowsToToggle.forEach((_row) =>
              _row.toggleSelected(!isCellSelected),
            );
          } else {
            row.toggleSelected();
          }
        }}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div>{row.getValue("id")}</div>,
  },
  {
    accessorKey: "name",
    header: "Ime in priimek",
    cell: ({ row }) => <div>{row.getValue("name")}</div>,
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const author = row.original;

      return <AuthorsTableCellButtons author={author} />;
    },
  },
];

export function AuthorsDataTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  });

  const all_authors = useAllAuthors();

  const data = useMemo(() => {
    if (!all_authors) return [];

    return all_authors.filter((author) => author.author_type === "guest");
  }, [all_authors]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 py-4">
        <Input
          placeholder="Filtriraj imena..."
          className="max-w-sm"
          value={
            (table.getColumn("name")?.getFilterValue() as string | undefined) ??
            ""
          }
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
        />
        <AuthorsTableHeaderButtons />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
          /* style={{
              height: `${pagination.pageSize * 53}px`,
            }} */
          >
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} od{" "}
          {table.getFilteredRowModel().rows.length} avtorjev izbranih.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prejšnja
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Naslednja
          </Button>
        </div>
      </div>
    </div>
  );
}

// https://github.com/TanStack/table/discussions/3068#discussioncomment-5052258
function get_row_range<T>(
  rows: Row<T>[],
  currentID: number,
  selectedID: number,
): Row<T>[] {
  const rangeStart = selectedID > currentID ? currentID : selectedID;
  const rangeEnd = rangeStart === currentID ? selectedID : currentID;
  return rows.slice(rangeStart, rangeEnd + 1);
}
