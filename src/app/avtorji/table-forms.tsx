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
import { insert_guest } from "~/server/author/insert";
import { rename_guest } from "~/server/author/rename";
import type {
	insert_guest_validator,
	rename_guest_validator,
} from "~/server/author/validator";
import type { GuestAuthor } from "./table";

export const edit_form_schema = z.object({
	name: z.string().min(1).max(255),
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
		mutationFn: (input: z.infer<typeof rename_guest_validator>) =>
			rename_guest(input),
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
			name: author.name,
		},
	});

	return (
		<Form {...form}>
			<form
				className="space-y-4"
				onSubmit={form.handleSubmit(() => {
					rename_guest_mutation.mutate({
						id: author.id,
						name: form.getValues("name"),
					});

					close_dialog();
				})}
			>
				<span>
					Staro ime in priimek: <b>{author.name}</b>, ID: <b>{author.id}</b>
				</span>
				<FormField
					control={form.control}
					name="name"
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
	name: z.string().min(1).max(255),
});

export function InsertAuthorForm() {
	const toaster = useToast();
	const router = useRouter();

	const insert_guest_mutation = useMutation({
		mutationFn: (input: z.infer<typeof insert_guest_validator>) =>
			insert_guest(input),
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
			name: "",
		},
	});

	return (
		<Form {...form}>
			<form
				className="space-y-4"
				onSubmit={form.handleSubmit(() => {
					insert_guest_mutation.mutate({ name: form.getValues("name") });
				})}
			>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>Ime in priimek</FormLabel>
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
