import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { DialogClose, DialogFooter } from "~/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { useToast } from "~/hooks/use-toast";
import { format_author_name } from "~/lib/author-name";
import { unwrap_server_function } from "~/lib/orpc-action";
import { insertGuest, renameGuest } from "~/server/orpc/author/procedures";
import type { GuestAuthor } from "./table";

export const edit_form_schema = z.object({
	first_name: z.string().min(1).max(255),
	last_name: z.string().min(1).max(255),
});

export function EditAuthorNameForm({
	author,
	close_dialog,
}: {
	author: GuestAuthor;
	close_dialog: () => void;
}) {
	const router = useRouter();
	const toaster = useToast();

	const rename_guest_mutation = useMutation({
		mutationFn: (input: Parameters<typeof renameGuest>[0]) =>
			unwrap_server_function(renameGuest(input)),
		onSettled: () => {
			router.refresh();
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri preimenovanju avtorja",
				description: error.message,
			});
		},
	});

	const form = useForm<z.infer<typeof edit_form_schema>>({
		resolver: zodResolver(edit_form_schema),
		defaultValues: {
			first_name: author.first_name,
			last_name: author.last_name,
		},
	});

	return (
		<Form {...form}>
			<form
				className="space-y-4"
				onSubmit={form.handleSubmit(() => {
					rename_guest_mutation.mutate({
						id: author.id,
						first_name: form.getValues("first_name"),
						last_name: form.getValues("last_name"),
					});

					close_dialog();
				})}
			>
				<span>
					Staro ime in priimek: <b>{format_author_name(author)}</b>, ID:{" "}
					<b>{author.id}</b>
				</span>
				<FormField
					control={form.control}
					name="first_name"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>Novo ime</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="last_name"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>Nov priimek</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<DialogFooter>
					<DialogClose>Prekliči</DialogClose>
					<DialogClose asChild>
						<Button type="submit">Preimenuj</Button>
					</DialogClose>
				</DialogFooter>
			</form>
		</Form>
	);
}

export const insert_form_schema = z.object({
	first_name: z.string().min(1).max(255),
	last_name: z.string().min(1).max(255),
});

export function InsertAuthorForm() {
	const toaster = useToast();
	const router = useRouter();

	const insert_guest_mutation = useMutation({
		mutationFn: (input: Parameters<typeof insertGuest>[0]) =>
			unwrap_server_function(insertGuest(input)),
		onSettled: () => {
			router.refresh();
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri dodajanju novega avtorja",
				description: error.message,
			});
		},
	});

	const form = useForm<z.infer<typeof insert_form_schema>>({
		resolver: zodResolver(insert_form_schema),
		defaultValues: {
			first_name: "",
			last_name: "",
		},
	});

	return (
		<Form {...form}>
			<form
				className="space-y-4"
				onSubmit={form.handleSubmit(() => {
					insert_guest_mutation.mutate({
						first_name: form.getValues("first_name"),
						last_name: form.getValues("last_name"),
					});
				})}
			>
				<FormField
					control={form.control}
					name="first_name"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>Ime</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="last_name"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>Priimek</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<DialogFooter>
					<DialogClose>Prekliči</DialogClose>
					<DialogClose asChild>
						<Button type="submit">Dodaj</Button>
					</DialogClose>
				</DialogFooter>
			</form>
		</Form>
	);
}
