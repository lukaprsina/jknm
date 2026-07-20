import { zodResolver } from "@hookform/resolvers/zod";
import { useContext } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	DraftArticleContext,
	useIsSupersedingDraft,
} from "~/components/article/context";
import DatePicker from "~/components/date-time-picker/new_date_picker";
import { editor_store } from "~/components/editor/editor-store";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
import { useEditorMutations } from "~/hooks/use-editor-mutations";
import { thumbnail_validator } from "~/lib/validators";
import { SUPERSEDING_DRAFT_DIALOGS } from "~/server/article/lifecycle-rules";
import { ImageSelector } from "./image-selector";

export const form_schema = z.object({
	created_at: z.date(),
	thumbnail_crop: thumbnail_validator.optional(),
});

export function SettingsForm({ closeDialog }: { closeDialog: () => void }) {
	const draft_article = useContext(DraftArticleContext);
	const editor_mutations = useEditorMutations();
	// "Zavrzi osnutek" is the low-stakes alternative to delete that only
	// discards the draft; see `useIsSupersedingDraft`.
	const is_superseding = useIsSupersedingDraft();
	const delete_dialog = is_superseding
		? SUPERSEDING_DRAFT_DIALOGS.delete
		: {
				title: "Izbriši novičko",
				description:
					"Ste prepričani, da želite izbrisati to novičko? Izbrisanih novičk ni mogoče obnoviti.",
			};

	const form = useForm<z.infer<typeof form_schema>>({
		resolver: zodResolver(form_schema),
		defaultValues: {
			thumbnail_crop: editor_store.getState().thumbnail_crop ?? undefined,
			created_at: draft_article?.created_at,
		},
	});

	return (
		<Form {...form}>
			<form className="space-y-4">
				<FormField
					control={form.control}
					name="created_at"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>Čas objave</FormLabel>
							<FormControl>
								<DatePicker date={field.value} setDate={field.onChange} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="thumbnail_crop"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Naslovna slika</FormLabel>
							<FormControl>
								<ImageSelector image={field.value} setImage={field.onChange} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Separator />
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1">
						{is_superseding && (
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									editor_mutations.discard_draft();
									closeDialog();
								}}
							>
								Zavrzi osnutek
							</Button>
						)}
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button type="button" variant="destructive">
									{is_superseding
										? "Izbriši objavljeno novičko"
										: "Izbriši novičko"}
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>{delete_dialog.title}</AlertDialogTitle>
									<AlertDialogDescription>
										{delete_dialog.description}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Prekliči</AlertDialogCancel>
									<AlertDialogAction
										onClick={() => {
											editor_mutations.delete_article();
											closeDialog();
										}}
									>
										Izbriši
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
					<div className="flex items-center justify-end gap-1">
						<Button
							onClick={form.handleSubmit(
								async (values: z.infer<typeof form_schema>) => {
									await editor_mutations.save_draft(
										values.created_at,
										values.thumbnail_crop,
									);
									closeDialog();
								},
							)}
							variant="secondary"
						>
							Shrani kot osnutek
						</Button>
						<Button
							onClick={form.handleSubmit(
								async (values: z.infer<typeof form_schema>) => {
									await editor_mutations.publish(
										values.created_at,
										values.thumbnail_crop,
									);
									closeDialog();
								},
							)}
						>
							Objavi spremembe
						</Button>
					</div>
				</div>
			</form>
		</Form>
	);
}
