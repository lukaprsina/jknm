"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

export const contact_form_schema = z.object({
	email: z.string().min(1, "Obvezno polje").email("Neveljaven e-poštni naslov"),
	name: z.string().min(1, "Obvezno polje"),
	address: z.string().min(1, "Obvezno polje"),
	interest: z.string().min(1, "Obvezno polje"),
});

export default function ContactForm() {
	const [sent, set_sent] = useState(false);
	const [send_failed, set_send_failed] = useState(false);
	const form = useForm<z.infer<typeof contact_form_schema>>({
		resolver: zodResolver(contact_form_schema),
		defaultValues: {
			email: "",
			name: "",
			address: "",
			interest: "",
		},
	});

	async function onSubmit(values: z.infer<typeof contact_form_schema>) {
		set_send_failed(false);
		try {
			const response = await fetch("/api/send", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(values),
			});

			if (!response.ok) {
				console.error(
					"Failed to send message",
					response.statusText,
					await response.json(),
				);
				set_send_failed(true);
				return;
			}

			set_sent(true);
		} catch (error) {
			console.error(error);
			set_send_failed(true);
		}
	}

	return (
		<div className="grid">
			<div
				aria-hidden={sent}
				className={cn(
					"[grid-area:1/1] transition-opacity duration-300",
					sent ? "invisible opacity-0" : "opacity-100",
				)}
			>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="ml-4 max-w-3xl space-y-4 md:ml-10"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem className="flex-col sm:flex sm:flex-row sm:items-start sm:gap-4">
									<FormLabel className="sm:w-40 sm:flex-none sm:text-right sm:leading-9">
										Ime in priimek:
									</FormLabel>
									<div className="flex-1">
										<FormControl>
											<Input
												autoComplete="name"
												placeholder=""
												type="text"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</div>
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="address"
							render={({ field }) => (
								<FormItem className="flex-col sm:flex sm:flex-row sm:items-start sm:gap-4">
									<FormLabel className="sm:w-40 sm:flex-none sm:text-right sm:leading-9">
										Prebivališče:
									</FormLabel>
									<div className="flex-1">
										<FormControl>
											<Input
												autoComplete="address-level2"
												placeholder=""
												type="text"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</div>
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem className="flex-col sm:flex sm:flex-row sm:items-start sm:gap-4">
									<FormLabel className="sm:w-40 sm:flex-none sm:text-right sm:leading-9">
										E-pošta:
									</FormLabel>
									<div className="flex-1">
										<FormControl>
											<Input
												autoComplete="email"
												placeholder=""
												type="email"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</div>
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="interest"
							render={({ field }) => (
								<FormItem className="flex-col sm:flex sm:flex-row sm:items-start sm:gap-4">
									<FormLabel className="sm:w-40 sm:flex-none sm:text-right sm:leading-9">
										Zanima me:
									</FormLabel>
									<div className="flex-1">
										<FormControl>
											<Textarea
												placeholder=""
												className="min-h-[80px] resize-none"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</div>
								</FormItem>
							)}
						/>
						<div className="sm:pl-44">
							<Button type="submit" disabled={form.formState.isSubmitting}>
								Pošlji sporočilo
							</Button>
							{send_failed && (
								<p className="mt-2 text-sm text-destructive">
									Napaka pri pošiljanju. Prosim, poskusite znova.
								</p>
							)}
						</div>
					</form>
				</Form>
			</div>
			<div
				aria-hidden={!sent}
				className={cn(
					"flex [grid-area:1/1] flex-col items-center justify-center gap-4 py-16 text-center transition-opacity duration-300",
					sent ? "opacity-100" : "invisible opacity-0",
				)}
			>
				<Check className="size-12 text-primary" strokeWidth={1.5} />
				<h2 className="text-xl font-semibold">Hvala za sporočilo!</h2>
				<p>Odgovorili vam bomo v najkrajšem možnem času.</p>
				<Button asChild>
					<Link href="/">Nazaj domov</Link>
				</Button>
			</div>
		</div>
	);
}
