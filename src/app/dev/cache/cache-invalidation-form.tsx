"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
} from "~/components/ui/form";
import { useToast } from "~/hooks/use-toast";
import { CACHE_PATHS, CACHE_TAGS, type CacheTag } from "~/lib/cache-policy";
import {
	type CacheInvalidationSelection,
	invalidate_selected_cache,
} from "~/server/cache-invalidation-action";

const TAG_LABELS: Record<CacheTag, string> = {
	drafts: "Osnutki",
	archive: "Arhiv",
	authors: "Avtorji",
	"homepage-feed": "Začetna stran",
	"all-published": "Vsi objavljeni članki",
	article: "Posamezni članki",
};

const PATH_LABELS: Record<(typeof CACHE_PATHS)[number], string> = {
	"/": "Začetna stran (/)",
	"/sitemap.xml": "Sitemap (/sitemap.xml)",
};

const EMPTY_SELECTION: CacheInvalidationSelection = { tags: [], paths: [] };

export function CacheInvalidationForm() {
	const form = useForm<CacheInvalidationSelection>({
		defaultValues: EMPTY_SELECTION,
	});
	const router = useRouter();
	const toaster = useToast();
	const selected_tags = form.watch("tags");
	const selected_paths = form.watch("paths");
	const has_selection = selected_tags.length > 0 || selected_paths.length > 0;
	const all_selected =
		selected_tags.length === CACHE_TAGS.length &&
		selected_paths.length === CACHE_PATHS.length;

	async function on_submit(selection: CacheInvalidationSelection) {
		try {
			const invalidated = await invalidate_selected_cache(selection);
			const count = invalidated.tags.length + invalidated.paths.length;
			toaster.toast({
				title: "Predpomnilnik osvežen",
				description: `${count} izbranih možnosti je bilo osveženih.`,
			});
			form.reset(EMPTY_SELECTION);
			router.refresh();
		} catch (error) {
			toaster.toast({
				title: "Napaka pri osveževanju predpomnilnika",
				description: error instanceof Error ? error.message : String(error),
			});
		}
	}

	function toggle_all(checked: boolean) {
		form.setValue("tags", checked ? [...CACHE_TAGS] : [], {
			shouldDirty: true,
			shouldValidate: true,
		});
		form.setValue("paths", checked ? [...CACHE_PATHS] : [], {
			shouldDirty: true,
			shouldValidate: true,
		});
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(on_submit)}
				className="max-w-xl space-y-6"
			>
				<div className="rounded-md border p-4">
					<div className="flex items-center gap-3">
						<Checkbox
							id="cache-select-all"
							checked={
								all_selected ? true : has_selection ? "indeterminate" : false
							}
							onCheckedChange={(value) => toggle_all(value === true)}
						/>
						<label htmlFor="cache-select-all" className="font-medium">
							Izberi vse
						</label>
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						Izberite eno ali več oznak oziroma poti za osvežitev.
					</p>
				</div>

				<div className="space-y-3">
					<h2 className="text-lg font-semibold">Oznake</h2>
					<FormField
						control={form.control}
						name="tags"
						render={({ field }) => (
							<div className="space-y-3">
								{CACHE_TAGS.map((tag) => (
									<FormItem
										key={tag}
										className="flex items-center gap-3 space-y-0"
									>
										<FormControl>
											<Checkbox
												id={`cache-tag-${tag}`}
												checked={field.value.includes(tag)}
												onCheckedChange={(value) => {
													const next = value
														? [...field.value, tag]
														: field.value.filter((item) => item !== tag);
													field.onChange([...new Set(next)]);
												}}
											/>
										</FormControl>
										<FormLabel htmlFor={`cache-tag-${tag}`}>
											{TAG_LABELS[tag]} ({tag})
										</FormLabel>
									</FormItem>
								))}
							</div>
						)}
					/>
				</div>

				<div className="space-y-3">
					<h2 className="text-lg font-semibold">Poti</h2>
					<FormField
						control={form.control}
						name="paths"
						render={({ field }) => (
							<div className="space-y-3">
								{CACHE_PATHS.map((path) => (
									<FormItem
										key={path}
										className="flex items-center gap-3 space-y-0"
									>
										<FormControl>
											<Checkbox
												id={`cache-path-${path.replaceAll("/", "-")}`}
												checked={field.value.includes(path)}
												onCheckedChange={(value) => {
													const next = value
														? [...field.value, path]
														: field.value.filter((item) => item !== path);
													field.onChange([...new Set(next)]);
												}}
											/>
										</FormControl>
										<FormLabel
											htmlFor={`cache-path-${path.replaceAll("/", "-")}`}
										>
											{PATH_LABELS[path]}
										</FormLabel>
									</FormItem>
								))}
							</div>
						)}
					/>
				</div>

				<div className="flex gap-3">
					<Button asChild variant="outline">
						<Link href="/">Domov</Link>
					</Button>
					<Button
						type="submit"
						disabled={!has_selection || form.formState.isSubmitting}
					>
						{form.formState.isSubmitting ? "Osvežujem…" : "OK"}
					</Button>
				</div>
			</form>
		</Form>
	);
}
