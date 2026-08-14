"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2,
	LogOut,
	RefreshCcw,
	SearchIcon,
	SettingsIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { useToast } from "~/hooks/use-toast";
import { sign_out } from "~/lib/auth-client";
import { format_author_name } from "~/lib/author-name";
import { apply_client_invalidations } from "~/lib/cache-invalidation-client";
import { unwrap_server_function } from "~/lib/orpc-action";
import type { AlgoliaSyncChange } from "~/server/article/sync-algolia-diff";
import type { MemberSyncChange } from "~/server/author/sync-members-diff";
import {
	previewAlgoliaSync,
	syncAlgolia,
} from "~/server/orpc/article/procedures";
import {
	previewMemberSync,
	syncMembers,
} from "~/server/orpc/author/procedures";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function SettingsDropdown() {
	const router = useRouter();
	const [sync_dialog_open, set_sync_dialog_open] = useState(false);
	const [algolia_dialog_open, set_algolia_dialog_open] = useState(false);

	return (
		<>
			<DropdownMenu>
				<Tooltip>
					<TooltipTrigger asChild>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon">
								<SettingsIcon size={22} className="" />
							</Button>
						</DropdownMenuTrigger>
					</TooltipTrigger>
					<TooltipContent>Nastavitve</TooltipContent>
				</Tooltip>
				<DropdownMenuContent className="w-56">
					<DropdownMenuLabel>Nastavitve</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem asChild>
						<Link href="/avtorji">
							<UsersIcon className="mr-2 h-4 w-4" />
							<span>Avtorji</span>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => set_sync_dialog_open(true)}>
						<RefreshCcw className="mr-2 h-4 w-4" size={18} />
						<span>Uskladi člane</span>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => set_algolia_dialog_open(true)}>
						<SearchIcon className="mr-2 h-4 w-4" size={18} />
						<span>Uskladi Algolia</span>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={async () => {
							await sign_out();
							router.push("/");
						}}
					>
						<LogOut className="mr-2 h-4 w-4" />
						<span>Odjava</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<MemberSyncDialog
				open={sync_dialog_open}
				onOpenChange={set_sync_dialog_open}
			/>
			<AlgoliaSyncDialog
				open={algolia_dialog_open}
				onOpenChange={set_algolia_dialog_open}
			/>
		</>
	);
}

const CHANGE_KIND_LABEL: Record<MemberSyncChange["kind"], string> = {
	new: "Nov",
	changed: "Spremenjen",
	missing: "Manjka",
};

const CHANGE_KIND_VARIANT: Record<
	MemberSyncChange["kind"],
	"default" | "secondary" | "destructive"
> = {
	new: "default",
	changed: "secondary",
	missing: "destructive",
};

const CHANGE_KIND_CLASS_NAME: Record<MemberSyncChange["kind"], string> = {
	new: "",
	changed: "border-transparent bg-amber-500 text-white hover:bg-amber-500/80",
	missing: "",
};

interface ChangeRow {
	key: string;
	name: string;
	details: string[];
}

function to_change_row(change: MemberSyncChange): ChangeRow {
	switch (change.kind) {
		case "new":
			return {
				key: change.google.google_id,
				name: format_author_name(change.google),
				details: [change.google.email ?? "—"],
			};
		case "changed":
			return {
				key: change.google.google_id,
				name: format_author_name(change.google),
				details: change.diffs.map(
					(diff) =>
						`${diff.field}: ${diff.before ?? "—"} → ${diff.after ?? "—"}`,
				),
			};
		case "missing":
			return {
				key: `db-${change.before.id}`,
				name: format_author_name(change.before),
				details: ["Ni več v Google Admin"],
			};
	}
}

function MemberSyncDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const toaster = useToast();
	const router = useRouter();
	const query_client = useQueryClient();

	const preview_mutation = useMutation({
		mutationFn: () => unwrap_server_function(previewMemberSync()),
		onError: (error) => {
			console.log("Error previewing member sync:", error);
			toaster.toast({
				title: "Napaka pri branju sprememb",
				description: error.message,
			});
		},
	});

	const sync_mutation = useMutation({
		mutationFn: () => unwrap_server_function(syncMembers()),
		onSuccess: async () => {
			await apply_client_invalidations(query_client, "author.synced");
			router.refresh();
			onOpenChange(false);
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri usklajevanju članov",
				description: error.message,
			});
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next_open) => {
				onOpenChange(next_open);
				if (!next_open) {
					preview_mutation.reset();
				}
			}}
		>
			<DialogContent
				className="max-w-3xl"
				aria-describedby="Uskladi člane z Google Admin"
			>
				<DialogHeader>
					<DialogTitle>Uskladi člane z Google Admin</DialogTitle>
					<DialogDescription>
						Primerjava trenutnega stanja z Google Admin. Prikazani so samo
						člani, ki bi se spremenili.
					</DialogDescription>
				</DialogHeader>

				{preview_mutation.isIdle && (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<SearchIcon />
							</EmptyMedia>
							<EmptyTitle>Preveri spremembe</EmptyTitle>
							<EmptyDescription>
								Primerjaj trenutno stanje z Google Admin.
							</EmptyDescription>
						</EmptyHeader>
						<Button onClick={() => preview_mutation.mutate()}>Preveri</Button>
					</Empty>
				)}
				{preview_mutation.isPending && <p>Nalaganje…</p>}
				{preview_mutation.isError && (
					<p className="text-destructive">
						Napaka: {preview_mutation.error.message}
					</p>
				)}
				{preview_mutation.data?.length === 0 && (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<CheckCircle2 />
							</EmptyMedia>
							<EmptyTitle>Ni sprememb</EmptyTitle>
							<EmptyDescription>
								Vsi člani so že usklajeni z Google Admin.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
				{preview_mutation.data && preview_mutation.data.length > 0 && (
					<div className="max-h-96 overflow-auto">
						<Table className="min-w-[40rem]">
							<TableHeader>
								<TableRow>
									<TableHead>Ime</TableHead>
									<TableHead>Sprememba</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{preview_mutation.data.map((change) => {
									const row = to_change_row(change);
									return (
										<TableRow key={row.key}>
											<TableCell className="whitespace-nowrap align-top">
												<div className="flex items-center gap-2">
													<Badge
														variant={CHANGE_KIND_VARIANT[change.kind]}
														className={CHANGE_KIND_CLASS_NAME[change.kind]}
													>
														{CHANGE_KIND_LABEL[change.kind]}
													</Badge>
													{row.name}
												</div>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{row.details.map((detail) => (
													<div key={detail} className="whitespace-nowrap">
														{detail}
													</div>
												))}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Prekliči
					</Button>
					<Button
						disabled={
							!preview_mutation.data ||
							preview_mutation.data.length === 0 ||
							sync_mutation.isPending
						}
						onClick={() => sync_mutation.mutate()}
					>
						{sync_mutation.isPending ? "Usklajujem…" : "Posodobi"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

const ALGOLIA_CHANGE_KIND_LABEL: Record<AlgoliaSyncChange["kind"], string> = {
	missing: "Manjka",
	stale: "Spremenjen",
	orphaned: "Odveč",
};

const ALGOLIA_CHANGE_KIND_VARIANT: Record<
	AlgoliaSyncChange["kind"],
	"default" | "secondary" | "destructive"
> = {
	missing: "default",
	stale: "secondary",
	orphaned: "destructive",
};

const ALGOLIA_CHANGE_KIND_CLASS_NAME: Record<
	AlgoliaSyncChange["kind"],
	string
> = {
	missing: "",
	stale: "border-transparent bg-amber-500 text-white hover:bg-amber-500/80",
	orphaned: "",
};

interface AlgoliaChangeRow {
	key: string;
	name: string;
	details: string[];
}

function to_algolia_change_row(change: AlgoliaSyncChange): AlgoliaChangeRow {
	switch (change.kind) {
		case "missing":
			return {
				key: change.article.id,
				name: change.article.title,
				details: [change.article.url],
			};
		case "stale":
			return {
				key: change.article.id,
				name: change.article.title,
				details: change.diffs.map(
					(diff) =>
						`${diff.field}: ${diff.before ?? "—"} → ${diff.after ?? "—"}`,
				),
			};
		case "orphaned":
			return {
				key: `algolia-${change.before.objectID}`,
				name: change.before.title,
				details: ["Ni več objavljen v bazi"],
			};
	}
}

function AlgoliaSyncDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const toaster = useToast();

	const preview_mutation = useMutation({
		mutationFn: () => unwrap_server_function(previewAlgoliaSync()),
		onError: (error) => {
			console.log("Error previewing Algolia sync:", error);
			toaster.toast({
				title: "Napaka pri branju sprememb",
				description: error.message,
			});
		},
	});

	const sync_mutation = useMutation({
		mutationFn: () => unwrap_server_function(syncAlgolia()),
		onSuccess: () => {
			onOpenChange(false);
		},
		onError: (error) => {
			toaster.toast({
				title: "Napaka pri usklajevanju Algolia",
				description: error.message,
			});
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next_open) => {
				onOpenChange(next_open);
				if (!next_open) {
					preview_mutation.reset();
				}
			}}
		>
			<DialogContent
				className="max-w-3xl"
				aria-describedby="Uskladi Algolia z bazo"
			>
				<DialogHeader>
					<DialogTitle>Uskladi Algolia z bazo</DialogTitle>
					<DialogDescription>
						Primerjava iskalnega indeksa z objavljenimi članki v bazi. Prikazani
						so samo članki, ki bi se spremenili.
					</DialogDescription>
				</DialogHeader>

				{preview_mutation.isIdle && (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<SearchIcon />
							</EmptyMedia>
							<EmptyTitle>Preveri spremembe</EmptyTitle>
							<EmptyDescription>
								Primerjaj Algolia indeks z objavljenimi članki.
							</EmptyDescription>
						</EmptyHeader>
						<Button onClick={() => preview_mutation.mutate()}>Preveri</Button>
					</Empty>
				)}
				{preview_mutation.isPending && <p>Nalaganje…</p>}
				{preview_mutation.isError && (
					<p className="text-destructive">
						Napaka: {preview_mutation.error.message}
					</p>
				)}
				{preview_mutation.data?.length === 0 && (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<CheckCircle2 />
							</EmptyMedia>
							<EmptyTitle>Ni sprememb</EmptyTitle>
							<EmptyDescription>
								Algolia je že usklajena z bazo.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
				{preview_mutation.data && preview_mutation.data.length > 0 && (
					<div className="max-h-96 overflow-auto">
						<Table className="min-w-160">
							<TableHeader>
								<TableRow>
									<TableHead>Ime</TableHead>
									<TableHead>Sprememba</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{preview_mutation.data.map((change) => {
									const row = to_algolia_change_row(change);
									return (
										<TableRow key={row.key}>
											<TableCell className="whitespace-nowrap align-top">
												<div className="flex items-center gap-2">
													<Badge
														variant={ALGOLIA_CHANGE_KIND_VARIANT[change.kind]}
														className={
															ALGOLIA_CHANGE_KIND_CLASS_NAME[change.kind]
														}
													>
														{ALGOLIA_CHANGE_KIND_LABEL[change.kind]}
													</Badge>
													{row.name}
												</div>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{row.details.map((detail) => (
													<div key={detail} className="whitespace-nowrap">
														{detail}
													</div>
												))}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Prekliči
					</Button>
					<Button
						disabled={
							!preview_mutation.data ||
							preview_mutation.data.length === 0 ||
							sync_mutation.isPending
						}
						onClick={() => sync_mutation.mutate()}
					>
						{sync_mutation.isPending ? "Usklajujem…" : "Posodobi"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
