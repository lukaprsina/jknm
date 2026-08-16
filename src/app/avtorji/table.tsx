"use client";

import type {
	ColumnDef,
	PaginationState,
	SortingState,
} from "@tanstack/react-table";
import {
	columnFilteringFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_includesString,
	flexRender,
	rowPaginationFeature,
	rowSortingFeature,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { XIcon } from "lucide-react";
import {
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
	useQueryStates,
} from "nuqs";
import { use, useMemo } from "react";

import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { Input } from "~/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { format_author_name } from "~/lib/author-name";
import { cn } from "~/lib/utils";
import { AllAuthorsContext } from "../provider";
import {
	AuthorsTableCellButtons,
	AuthorsTableHeaderButtons,
} from "./table-buttons";

export interface GuestAuthor {
	id: number;
	first_name: string;
	last_name: string;
}

export const features = tableFeatures({
	rowSortingFeature,
	columnFilteringFeature,
	columnVisibilityFeature,
	rowPaginationFeature,
	sortedRowModel: createSortedRowModel(),
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	filterFns: { includesString: filterFn_includesString },
});

const COLUMN_WIDTH_CLASSES: Record<string, string> = {
	id: "w-20",
	actions: "w-24",
};

export function AuthorsDataTable() {
	const [urlState, setUrlState] = useQueryStates({
		sort: parseAsString,
		dir: parseAsStringLiteral(["asc", "desc"] as const),
		// URL is 1-based (link-friendly); pageIndex below is 0-based.
		page: parseAsInteger.withDefault(1),
	});

	const sorting: SortingState = urlState.sort
		? [{ id: urlState.sort, desc: urlState.dir === "desc" }]
		: [];
	const pagination: PaginationState = {
		pageIndex: Math.max(0, urlState.page - 1),
		pageSize: 8,
	};

	const setSorting: (
		updater: SortingState | ((prev: SortingState) => SortingState),
	) => void = (updater) => {
		const next = typeof updater === "function" ? updater(sorting) : updater;
		const [first] = next;
		void setUrlState({
			sort: first?.id ?? null,
			dir: first ? (first.desc ? "desc" : "asc") : null,
		});
	};

	const setPagination: (
		updater: PaginationState | ((prev: PaginationState) => PaginationState),
	) => void = (updater) => {
		const next = typeof updater === "function" ? updater(pagination) : updater;
		void setUrlState({ page: next.pageIndex + 1 });
	};

	const columns = useMemo<ColumnDef<typeof features, GuestAuthor>[]>(
		() => [
			{
				accessorKey: "id",
				header: "ID",
				cell: ({ row }) => <div>{row.getValue("id")}</div>,
			},
			{
				id: "name",
				accessorFn: (author) => format_author_name(author),
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

	const table = useTable({
		features,
		data: guest_authors,
		columns,
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		state: {
			sorting,
			pagination,
		},
	});

	const name_filter = (table.getColumn("name")?.getFilterValue() as
		| string
		| undefined) ?? "";

	return (
		<div className="w-full">
			<div className="flex items-center gap-2 py-4">
				<div className="relative min-w-0 flex-1">
					<Input
						placeholder="Filtriraj imena..."
						className="pr-8"
						value={name_filter}
						onChange={(event) =>
							table.getColumn("name")?.setFilterValue(event.target.value)
						}
					/>
					{name_filter !== "" && (
						<button
							type="button"
							aria-label="Počisti filter"
							className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground hover:text-foreground"
							onClick={() => table.getColumn("name")?.setFilterValue("")}
						>
							<XIcon className="size-4" />
						</button>
					)}
				</div>
				<AuthorsTableHeaderButtons authors={guest_authors} />
			</div>
			<Table className="min-w-md w-full table-fixed">
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => {
								return (
									<TableHead
										key={header.id}
										className={cn(
											"h-9 px-2",
											COLUMN_WIDTH_CLASSES[header.column.id],
										)}
									>
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
				<TableBody>
					{table.getRowModel().rows.length ? (
						table.getRowModel().rows.map((row) => (
							<TableRow key={row.id}>
								{row.getVisibleCells().map((cell) => (
									<TableCell
										key={cell.id}
										className={cn(
											"p-2",
											COLUMN_WIDTH_CLASSES[cell.column.id],
										)}
									>
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
							<TableCell colSpan={columns.length} className="h-24 text-center">
								Ni najdenih avtorjev.
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
			<div className="flex items-center justify-end gap-2 py-4">
				<ButtonGroup>
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
				</ButtonGroup>
			</div>
		</div>
	);
}
