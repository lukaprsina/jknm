"use client";

import { useMutation } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useToast } from "~/hooks/use-toast";
import { format_author_name } from "~/lib/author-name";
import { unwrap_server_function } from "~/lib/orpc-action";
import { deleteGuests } from "~/server/orpc/author/procedures";
import type { GuestAuthor } from "./table";
import { EditAuthorNameForm, InsertAuthorForm } from "./table-forms";

export function AuthorsTableCellButtons({ author }: { author: GuestAuthor }) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const toaster = useToast();
	const router = useRouter();

	const delete_guests_mutation = useMutation({
		mutationFn: (input: Parameters<typeof deleteGuests>[0]) =>
			unwrap_server_function(deleteGuests(input)),
		onSettled: () => {
			router.refresh();
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri brisanju avtorjev",
				description: error.message,
			});
		},
	});

	return (
		<div className="flex gap-1">
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<Tooltip>
					<TooltipTrigger asChild>
						<DialogTrigger asChild>
							<Button size="icon" variant="ghost" className="size-7">
								<PencilIcon className="size-4" />
							</Button>
						</DialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Uredi ime in priimek avtorja</TooltipContent>
				</Tooltip>
				<DialogContent aria-describedby="Uredi ime in priimek avtorja">
					<DialogHeader>
						<DialogTitle>Uredi ime in priimek avtorja</DialogTitle>
					</DialogHeader>
					{/* HERE */}
					<EditAuthorNameForm
						close_dialog={() => setDialogOpen(false)}
						author={author}
					/>
				</DialogContent>
			</Dialog>
			<AlertDialog>
				<Tooltip>
					<TooltipTrigger asChild>
						<AlertDialogTrigger asChild>
							<Button size="icon" variant="ghost" className="size-7">
								<TrashIcon className="size-4" />
							</Button>
						</AlertDialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Izbrišite avtorja</TooltipContent>
				</Tooltip>
				<AlertDialogContent aria-describedby="Izbrišite avtorja">
					<AlertDialogHeader>
						<AlertDialogTitle>Izbrišite avtorja</AlertDialogTitle>
					</AlertDialogHeader>
					<span>
						Ste prepričani, da želite izbrisati avtorja z imenom{" "}
						<b>{format_author_name(author)}</b>?
					</span>
					<AlertDialogFooter>
						<AlertDialogCancel>Prekliči</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								delete_guests_mutation.mutate({ ids: [author.id] });
								setDialogOpen(false);
							}}
						>
							OK
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

export function AuthorsTableHeaderButtons({
	authors,
}: {
	authors: GuestAuthor[];
}) {
	const toaster = useToast();
	const router = useRouter();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

	const delete_guests_mutation = useMutation({
		mutationFn: (input: Parameters<typeof deleteGuests>[0]) =>
			unwrap_server_function(deleteGuests(input)),
		onSettled: () => {
			router.refresh();
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri brisanju avtorjev",
				description: error.message,
			});
		},
	});

	const toggle_id = (id: number, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	};

	return (
		<ButtonGroup>
			<Dialog>
				<Tooltip>
					<TooltipTrigger asChild>
						<DialogTrigger asChild>
							<Button size="icon" variant="outline">
								<PlusIcon className="size-4" />
							</Button>
						</DialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Dodajte avtorja</TooltipContent>
				</Tooltip>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Dodajte avtorja</DialogTitle>
						<DialogDescription>
							Dodajte samo avtorje, ki niso člani in niso v bazi Google Admin.
						</DialogDescription>
					</DialogHeader>
					{/* HERE */}
					<InsertAuthorForm />
				</DialogContent>
			</Dialog>
			<Dialog
				open={deleteDialogOpen}
				onOpenChange={(open) => {
					setDeleteDialogOpen(open);
					if (!open) setSelectedIds(new Set());
				}}
			>
				<Tooltip>
					<TooltipTrigger asChild>
						<DialogTrigger asChild>
							<Button size="icon" variant="outline">
								<TrashIcon className="size-4" />
							</Button>
						</DialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Izbrišite avtorje</TooltipContent>
				</Tooltip>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Izbrišite avtorje</DialogTitle>
						<DialogDescription>
							Izberite avtorje, ki jih želite izbrisati.
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-64 space-y-2 overflow-y-auto">
						{authors.map((author) => (
							<div key={author.id} className="flex items-center gap-2 text-sm">
								<Checkbox
									id={`delete-author-${author.id}`}
									checked={selectedIds.has(author.id)}
									onCheckedChange={(value) => toggle_id(author.id, !!value)}
								/>
								<label htmlFor={`delete-author-${author.id}`}>
									{format_author_name(author)}
								</label>
							</div>
						))}
					</div>
					<DialogFooter>
						<Button
							variant="destructive"
							disabled={selectedIds.size === 0}
							onClick={() => {
								delete_guests_mutation.mutate({ ids: [...selectedIds] });
								setDeleteDialogOpen(false);
								setSelectedIds(new Set());
							}}
						>
							Izbriši ({selectedIds.size})
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</ButtonGroup>
	);
}
