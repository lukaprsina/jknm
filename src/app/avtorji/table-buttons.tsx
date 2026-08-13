"use client";

import { useMutation } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { unwrap_server_function } from "~/lib/orpc-action";
import { deleteGuests } from "~/server/orpc/author/procedures";
import type { features, GuestAuthor } from "./table";
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
							<Button size="icon" variant="ghost">
								<PencilIcon size={18} />
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
							<Button size="icon" variant="ghost">
								<TrashIcon size={18} />
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
						<b>{author.name}</b>?
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
	rows,
}: {
	rows: Row<typeof features, GuestAuthor>[];
}) {
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

	const message = useMemo(() => {
		const length = rows.length;
		// console.log({ length });
		if (length === 0)
			return "Najprej izberite avtorje, ki jih želite izbrisati.";

		let sklon: React.ReactNode | undefined;
		if (length === 1) {
			const name = rows[0]?.original.name;
			sklon = (
				<>
					avtorja z imenom <b>{name}</b>
				</>
			);
		} else if (length === 2) {
			sklon = <b>{length} avtorja</b>;
		} else if (length === 3 || length === 4) {
			sklon = <b>{length} avtorje</b>;
		} else {
			sklon = <b>{length} avtorjev</b>;
		}

		return <span>Ste prepričani, da želite izbrisati {sklon}?</span>;
	}, [rows]);

	return (
		<div className="flex grow gap-1">
			<Dialog>
				<Tooltip>
					<TooltipTrigger asChild>
						<DialogTrigger asChild>
							<Button size="icon" variant="outline">
								<PlusIcon size={18} />
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
			<AlertDialog>
				<Tooltip>
					<TooltipTrigger asChild>
						<AlertDialogTrigger asChild>
							<Button size="icon" variant="outline">
								<TrashIcon size={18} />
							</Button>
						</AlertDialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Izbrišite izbrane avtorje</TooltipContent>
				</Tooltip>
				<AlertDialogContent>
					<AlertDialogHeader aria-describedby="Izbrišite izbrane avtorje">
						<AlertDialogTitle>Izbrišite izbrane avtorje</AlertDialogTitle>
					</AlertDialogHeader>
					{message}
					<AlertDialogFooter>
						<AlertDialogCancel>
							{rows.length === 0 ? "Nazaj" : "Ne izbriši"}
						</AlertDialogCancel>
						{rows.length !== 0 && (
							<AlertDialogAction
								onClick={() => {
									delete_guests_mutation.mutate({
										ids: rows.map((row) => row.original.id),
									});
								}}
							>
								Izbriši
							</AlertDialogAction>
						)}
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
