import { Settings2Icon } from "lucide-react";
import { useContext, useState } from "react";
import { EditorContext } from "~/components/editor/editor-context";
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
import { SettingsForm } from "./settings-form";

export function SettingsDialog() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const editor_context = useContext(EditorContext);
	if (!editor_context) return null;

	return (
		<Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
			<Tooltip>
				<TooltipTrigger asChild>
					<DialogTrigger asChild>
						<Button variant="ghost" size="icon">
							<Settings2Icon size={18} />
						</Button>
					</DialogTrigger>
				</TooltipTrigger>
				<TooltipContent>Nastavitve</TooltipContent>
			</Tooltip>
			{/* sm:max-w-[425px] */}
			<DialogContent className="sm:pt-4 sm:max-w-[90vw]">
				<DialogHeader>
					<DialogTitle>Nastavitve</DialogTitle>
					<DialogDescription>
						Določi naslovno sliko in čas objave.
					</DialogDescription>
				</DialogHeader>
				<SettingsForm closeDialog={() => setDialogOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}
