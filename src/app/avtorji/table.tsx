"use client";

import type {
	ColumnDef,
	PaginationState,
	Row,
	SortingState,
} from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { use, useMemo, useRef, useState } from "react";

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
import { AllAuthorsContext } from "../provider";
import {
	AuthorsTableCellButtons,
	AuthorsTableHeaderButtons,
} from "./table-buttons";

export interface GuestAuthor {
	id: number;
	name: string;
}

export function AuthorsDataTable() {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [rowSelection, setRowSelection] = useState({});
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 8,
	});
	const lastSelectedIndexRef = useRef<number | null>(null);

	const columns = useMemo<ColumnDef<GuestAuthor>[]>(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() && "indeterminate")
						}
						onCheckedChange={(value) =>
							table.toggleAllPageRowsSelected(!!value)
						}
						aria-label="Select all"
					/>
				),
				cell: ({ row, table }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(!!value)}
						onClick={(event) => {
							if (event.shiftKey && lastSelectedIndexRef.current !== null) {
								const { rows, rowsById } = table.getRowModel();
								const rowsToToggle = get_row_range(
									rows,
									row.index,
									lastSelectedIndexRef.current,
								);
								const isCellSelected = rowsById[row.id]?.getIsSelected();
								rowsToToggle.forEach((_row) => {
									_row.toggleSelected(!isCellSelected);
								});
							}
							lastSelectedIndexRef.current = row.index;
						}}
						aria-label="Select row"
					/>
				),
				enableSorting: false,
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
				cell: ({ row }) => {
					const author = row.original;

					return <AuthorsTableCellButtons author={author} />;
				},
			},
		],
		[],
	);

	const all_authors = use(AllAuthorsContext);
	const guest_authors = useMemo(
		() => all_authors.filter((author) => author.author_type === "guest"),
		[all_authors],
	);

	const table = useReactTable({
		data: guest_authors,
		columns,
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onRowSelectionChange: setRowSelection,
		onPaginationChange: setPagination,
		state: {
			sorting,
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
				<AuthorsTableHeaderButtons rows={table.getSelectedRowModel().rows} />
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
						Prejšnja stran
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Naslednja stran
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
