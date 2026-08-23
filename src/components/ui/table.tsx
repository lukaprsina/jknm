import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/lib/utils";

// Shared row-density scale for every <Table> in the app: `default` is the
// unmodified shadcn look (unused so far, kept as an explicit opt-in rather
// than deleting it). `dense` is used for scanned admin data, while `article`
// has its own padding rhythm plus cell borders and a header background since
// it is read as prose content.
const tableHeadVariants = cva(
	"align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
	{
		variants: {
			variant: {
				default: "h-12 px-4 text-left",
				dense: "h-auto py-[1px] px-2 text-left",
				article: "h-auto border py-[1px] px-2 text-left bg-muted/50",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

const tableCellVariants = cva("align-middle [&:has([role=checkbox])]:pr-0", {
	variants: {
		variant: {
			default: "p-4",
			dense: "py-[1px] px-2",
			article: "border py-[1px] px-2",
		},
	},
	defaultVariants: { variant: "default" },
});

const Table = React.forwardRef<
	HTMLTableElement,
	React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
	<div className="relative w-full overflow-auto">
		<table
			ref={ref}
			className={cn("w-full caption-bottom text-sm", className)}
			{...props}
		/>
	</div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
	HTMLTableSectionElement,
	React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
	<thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
	HTMLTableSectionElement,
	React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
	<tbody
		ref={ref}
		className={cn("[&_tr:last-child]:border-0", className)}
		{...props}
	/>
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
	HTMLTableSectionElement,
	React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
	<tfoot
		ref={ref}
		className={cn(
			"border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
			className,
		)}
		{...props}
	/>
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
	HTMLTableRowElement,
	React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
	<tr
		ref={ref}
		className={cn(
			"border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
			className,
		)}
		{...props}
	/>
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
	HTMLTableCellElement,
	React.ThHTMLAttributes<HTMLTableCellElement> &
		VariantProps<typeof tableHeadVariants>
>(({ className, variant, ...props }, ref) => (
	<th
		ref={ref}
		className={cn(tableHeadVariants({ variant }), className)}
		{...props}
	/>
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
	HTMLTableCellElement,
	React.TdHTMLAttributes<HTMLTableCellElement> &
		VariantProps<typeof tableCellVariants>
>(({ className, variant, ...props }, ref) => (
	<td
		ref={ref}
		className={cn(tableCellVariants({ variant }), className)}
		{...props}
	/>
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
	HTMLTableCaptionElement,
	React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
	<caption
		ref={ref}
		className={cn("mt-4 text-sm text-muted-foreground", className)}
		{...props}
	/>
));
TableCaption.displayName = "TableCaption";

export {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
};
