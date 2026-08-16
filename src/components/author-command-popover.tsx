"use client";

import { CheckIcon, UsersIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "~/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type { PublicAuthor } from "~/server/author/public-shape";

export interface AuthorOption {
	value: string;
	author: PublicAuthor | null;
	label: string;
}

const MAX_VISIBLE_AVATARS = 3;

// No PublicAuthor field carries a photo (deliberately — see public-shape.ts),
// so initials are the only avatar content available anywhere this renders.
function initials(author: PublicAuthor | null, fallback_label: string) {
	if (!author) return fallback_label.slice(0, 2).toUpperCase();
	return `${author.first_name[0] ?? ""}${author.last_name[0] ?? ""}`.toUpperCase();
}

/**
 * Shared author picker: avatar-stack trigger + a `Command` popover that
 * toggles selection without closing (mirrors the shell's `Searchbar`
 * primitives). Used identically by the arhiv author facet and the editor
 * toolbar so there is exactly one place selected authors are displayed and
 * exactly one place they're removed.
 */
export function AuthorCommandPopover({
	options,
	selectedValues,
	onToggle,
	onClear,
	placeholder = "Avtorji",
	className,
}: {
	options: AuthorOption[];
	selectedValues: string[];
	onToggle: (value: string) => void;
	onClear?: () => void;
	placeholder?: string;
	className?: string;
}) {
	const selected_options = options.filter((option) =>
		selectedValues.includes(option.value),
	);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className={cn(
						"h-10 w-full justify-start gap-2 font-normal",
						className,
					)}
				>
					{selected_options.length > 0 ? (
						<div className="flex -space-x-2">
							{selected_options.slice(0, MAX_VISIBLE_AVATARS).map((option) => (
								<Tooltip key={option.value}>
									<TooltipTrigger asChild>
										<Avatar className="h-6 w-6 border-2 border-background text-[10px]">
											<AvatarFallback>
												{initials(option.author, option.label)}
											</AvatarFallback>
										</Avatar>
									</TooltipTrigger>
									<TooltipContent>{option.label}</TooltipContent>
								</Tooltip>
							))}
							{selected_options.length > MAX_VISIBLE_AVATARS && (
								<Avatar className="h-6 w-6 border-2 border-background text-[10px]">
									<AvatarFallback>
										+{selected_options.length - MAX_VISIBLE_AVATARS}
									</AvatarFallback>
								</Avatar>
							)}
						</div>
					) : (
						<UsersIcon className="size-4 shrink-0 text-muted-foreground" />
					)}
					<span
						className={cn("truncate", selected_options.length > 0 && "sr-only")}
					>
						{placeholder}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto min-w-56 p-0" align="start">
				<Command>
					<CommandInput placeholder="Išči..." />
					<CommandList>
						<CommandEmpty>Ni najdenih rezultatov.</CommandEmpty>
						<CommandGroup>
							{options.map((option) => {
								const is_selected = selectedValues.includes(option.value);
								return (
									<CommandItem
										key={option.value}
										value={option.label}
										onSelect={() => onToggle(option.value)}
										className="cursor-pointer gap-2"
									>
										<Avatar className="h-6 w-6 text-[10px]">
											<AvatarFallback>
												{initials(option.author, option.label)}
											</AvatarFallback>
										</Avatar>
										<span className="flex-1">{option.label}</span>
										{is_selected && <CheckIcon className="size-4" />}
									</CommandItem>
								);
							})}
						</CommandGroup>
						{onClear && selectedValues.length > 0 && (
							<>
								<CommandSeparator />
								<CommandGroup>
									<CommandItem
										onSelect={onClear}
										className="cursor-pointer justify-center text-muted-foreground"
									>
										Počisti
									</CommandItem>
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
